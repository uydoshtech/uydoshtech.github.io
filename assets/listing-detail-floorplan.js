// Part of listing.html's detail-page script family (classic <script defer>, shared
// global scope — see listing-detail.js for the module map).
//
// This file: the 2D blueprint floor plan behind the room scan viewer's "2D" tab
// (see createRoomScanPlanToggle in listing-detail-roomscan.js). The mobile app's 2D
// tab is iOS-native Swift (FloorPlanCanvas.swift & co.) drawing a vector plan from
// the USDZ geometry, so its code can't run here — instead this module re-derives the
// same plan from the GLB the web viewer already downloads: RoomPlan walls/doors/
// windows/objects survive the backend's Blender conversion as individual named
// meshes (Wall0_color, Door0_color, Chair0_color, ... — see
// applyRoomScanStylizedMaterials.ts in uydosh_backend), so their footprints can be
// recovered per-primitive and drawn as an SVG blueprint with measurements.
//
// Ported algorithms (kept deliberately close to their sources for auditability):
// - Convex hull + rotating-calipers min-area oriented rectangle:
//   uydosh_backend's computeRoomScanFootprintFromGlb.ts (itself a port of
//   RoomScanMetricsComputer.swift).
// - Plan projection (world X → plan X, world Z → plan Y-down, i.e. iOS's (x, -z)
//   with SVG's flipped Y axis folded in) and "rotate so the longest wall is
//   horizontal" alignment: FloorPlanProjectionService.swift /
//   FloorPlanAlignmentService.swift.

      // --- Minimal GLB/glTF parsing (positions + material names only) -------------------
      // No three.js/gltf-transform dependency: RoomPlan-converted GLBs are small, simple
      // scenes (a few dozen box meshes), and all the plan needs is each primitive's
      // world-space vertex positions and its material name.

      /** Parses a GLB container into its glTF JSON and binary chunk. */
      function fpParseGlbContainer(arrayBuffer) {
        const dv = new DataView(arrayBuffer);
        if (dv.getUint32(0, true) !== 0x46546c67) throw new Error('not a GLB (bad magic)');
        if (dv.getUint32(4, true) !== 2) throw new Error('unsupported GLB version');
        let offset = 12;
        let json = null;
        let bin = null;
        while (offset + 8 <= arrayBuffer.byteLength) {
          const chunkLength = dv.getUint32(offset, true);
          const chunkType = dv.getUint32(offset + 4, true);
          const chunkStart = offset + 8;
          if (chunkType === 0x4e4f534a) {
            json = JSON.parse(new TextDecoder().decode(new Uint8Array(arrayBuffer, chunkStart, chunkLength)));
          } else if (chunkType === 0x004e4942) {
            bin = new Uint8Array(arrayBuffer, chunkStart, chunkLength);
          }
          offset = chunkStart + chunkLength;
        }
        if (!json || !bin) throw new Error('GLB missing JSON or BIN chunk');
        return { json, bin };
      }

      // Column-major 4x4 matrix helpers (glTF/WebGL convention).
      function fpMat4Multiply(a, b) {
        const out = new Array(16);
        for (let c = 0; c < 4; c++) {
          for (let r = 0; r < 4; r++) {
            out[c * 4 + r] =
              a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
          }
        }
        return out;
      }

      /** Composes a node's local matrix from `matrix` or TRS (glTF defaults applied). */
      function fpNodeLocalMatrix(node) {
        if (node.matrix) return node.matrix;
        const [tx, ty, tz] = node.translation || [0, 0, 0];
        const [qx, qy, qz, qw] = node.rotation || [0, 0, 0, 1];
        const [sx, sy, sz] = node.scale || [1, 1, 1];
        // Standard quaternion → rotation matrix, then bake scale into the basis vectors.
        const x2 = qx + qx, y2 = qy + qy, z2 = qz + qz;
        const xx = qx * x2, xy = qx * y2, xz = qx * z2;
        const yy = qy * y2, yz = qy * z2, zz = qz * z2;
        const wx = qw * x2, wy = qw * y2, wz = qw * z2;
        return [
          (1 - (yy + zz)) * sx, (xy + wz) * sx, (xz - wy) * sx, 0,
          (xy - wz) * sy, (1 - (xx + zz)) * sy, (yz + wx) * sy, 0,
          (xz + wy) * sz, (yz - wx) * sz, (1 - (xx + yy)) * sz, 0,
          tx, ty, tz, 1,
        ];
      }

      /** Reads a VEC3 float accessor into a tightly-packed Float32Array copy. */
      function fpReadVec3Accessor(json, bin, accessorIndex) {
        const accessor = json.accessors?.[accessorIndex];
        if (!accessor || accessor.componentType !== 5126 || accessor.type !== 'VEC3') return null;
        const view = json.bufferViews?.[accessor.bufferView];
        if (!view) return null;
        const stride = view.byteStride || 12;
        const base = (view.byteOffset || 0) + (accessor.byteOffset || 0);
        const out = new Float32Array(accessor.count * 3);
        const dv = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
        for (let i = 0; i < accessor.count; i++) {
          const p = base + i * stride;
          out[i * 3] = dv.getFloat32(p, true);
          out[i * 3 + 1] = dv.getFloat32(p + 4, true);
          out[i * 3 + 2] = dv.getFloat32(p + 8, true);
        }
        return out;
      }

      /**
       * Walks the default scene and returns one entry per mesh primitive:
       * `{ name, points }` where `name` is the material name (falling back to the node
       * name — both carry RoomPlan's category, e.g. "Wall0_color" / "Wall0") and
       * `points` are world-space plan-projected 2D vertices ({x, y} in meters,
       * y = world Z so the plan reads exactly like the iOS top-down view in SVG's
       * y-down coordinates).
       */
      function fpExtractPrimitives(json, bin) {
        const out = [];
        const sceneDef = json.scenes?.[json.scene || 0];
        if (!sceneDef) return out;
        const visit = (nodeIndex, parentMatrix) => {
          const node = json.nodes?.[nodeIndex];
          if (!node) return;
          const world = fpMat4Multiply(parentMatrix, fpNodeLocalMatrix(node));
          if (node.mesh != null) {
            const mesh = json.meshes?.[node.mesh];
            for (const prim of mesh?.primitives || []) {
              if (prim.mode != null && prim.mode !== 4) continue; // triangles only
              const positions = prim.attributes && fpReadVec3Accessor(json, bin, prim.attributes.POSITION);
              if (!positions) continue;
              const materialName = json.materials?.[prim.material]?.name;
              const name = materialName || mesh.name || node.name || '';
              const points = [];
              for (let i = 0; i < positions.length; i += 3) {
                const x = positions[i], y = positions[i + 1], z = positions[i + 2];
                points.push({
                  x: world[0] * x + world[4] * y + world[8] * z + world[12],
                  y: world[2] * x + world[6] * y + world[10] * z + world[14],
                });
              }
              out.push({ name, points });
            }
          }
          for (const child of node.children || []) visit(child, world);
        };
        const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
        for (const rootIndex of sceneDef.nodes || []) visit(rootIndex, identity);
        return out;
      }

      // --- Footprint geometry (ported from computeRoomScanFootprintFromGlb.ts) ----------

      function fpDedupePoints(points, epsilon = 0.02) {
        const out = [];
        for (const p of points) {
          if (!out.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < epsilon)) out.push(p);
        }
        return out;
      }

      /** Monotone-chain convex hull on the plan plane. */
      function fpConvexHull(points) {
        const sorted = [...points].sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));
        if (sorted.length < 3) return sorted;
        const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
        const lower = [];
        for (const p of sorted) {
          while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
          lower.push(p);
        }
        const upper = [];
        for (const p of [...sorted].reverse()) {
          while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
          upper.push(p);
        }
        lower.pop();
        upper.pop();
        return lower.concat(upper);
      }

      /**
       * Minimum-area oriented bounding rectangle via rotating calipers — same algorithm
       * as the backend/iOS ports, but returning the full oriented rect
       * `{ cx, cy, len, thick, angle }` (angle of the long axis, radians) rather than
       * just long/short extents, since the plan needs to *draw* it.
       */
      function fpMinAreaOrientedRect(points) {
        const unique = fpDedupePoints(points);
        if (unique.length < 2) return null;
        const hull = fpConvexHull(unique);
        const ring = hull.length >= 3 ? hull : unique;
        let best = null;
        for (let i = 0; i < ring.length; i++) {
          const p1 = ring[i];
          const p2 = ring[(i + 1) % ring.length];
          const edgeYaw = Math.atan2(p2.y - p1.y, p2.x - p1.x);
          const cosA = Math.cos(-edgeYaw);
          const sinA = Math.sin(-edgeYaw);
          let minRX = Infinity, maxRX = -Infinity, minRY = Infinity, maxRY = -Infinity;
          for (const p of unique) {
            const rx = p.x * cosA - p.y * sinA;
            const ry = p.x * sinA + p.y * cosA;
            if (rx < minRX) minRX = rx;
            if (rx > maxRX) maxRX = rx;
            if (ry < minRY) minRY = ry;
            if (ry > maxRY) maxRY = ry;
          }
          const w = maxRX - minRX;
          const h = maxRY - minRY;
          if (!best || w * h < best.area) {
            // Rotate the rect center back into plan space.
            const rcx = (minRX + maxRX) / 2;
            const rcy = (minRY + maxRY) / 2;
            best = {
              area: w * h,
              cx: rcx * Math.cos(edgeYaw) - rcy * Math.sin(edgeYaw),
              cy: rcx * Math.sin(edgeYaw) + rcy * Math.cos(edgeYaw),
              len: Math.max(w, h),
              thick: Math.min(w, h),
              angle: w >= h ? edgeYaw : edgeYaw + Math.PI / 2,
            };
          }
        }
        if (!best) return null;
        // Normalize the long-axis angle into (-π/2, π/2] so labels/side picks are stable.
        let a = best.angle;
        while (a > Math.PI / 2) a -= Math.PI;
        while (a <= -Math.PI / 2) a += Math.PI;
        return { cx: best.cx, cy: best.cy, len: best.len, thick: best.thick, angle: a };
      }

      // --- Plan model extraction ---------------------------------------------------------

      // Mirrors classifyRoomScanMaterialName (listing-detail-roomscan.js) but keeps the
      // wall-like categories separate — the plan draws doors/windows/openings differently.
      function fpClassifyName(name) {
        const n = (name || '').toLowerCase();
        if (!n) return 'other';
        if (n.includes('door')) return 'door';
        if (n.includes('window')) return 'window';
        if (n.includes('opening')) return 'opening';
        if (n.includes('ceiling')) return 'ceiling';
        if (n.startsWith('wall')) return 'wall';
        if (n.startsWith('floor') || n.includes('ground')) return 'floor';
        return 'furniture';
      }

      function fpRotatePoint(p, angle, origin) {
        const c = Math.cos(angle), s = Math.sin(angle);
        const dx = p.x - origin.x, dy = p.y - origin.y;
        return { x: origin.x + dx * c - dy * s, y: origin.y + dx * s + dy * c };
      }

      function fpRectCorners(rect) {
        const c = Math.cos(rect.angle), s = Math.sin(rect.angle);
        const hx = rect.len / 2, hy = rect.thick / 2;
        return [
          { x: rect.cx + hx * c - hy * s, y: rect.cy + hx * s + hy * c },
          { x: rect.cx + hx * c + hy * s, y: rect.cy + hx * s - hy * c },
          { x: rect.cx - hx * c + hy * s, y: rect.cy - hx * s - hy * c },
          { x: rect.cx - hx * c - hy * s, y: rect.cy - hx * s + hy * c },
        ];
      }

      /**
       * Builds the plan model from raw GLB bytes: classified oriented rects for walls /
       * doors / windows / openings / furniture, aligned so the longest wall runs
       * horizontally (mirrors FloorPlanAlignmentService.swift), plus overall bounds.
       * Returns null when there's nothing plan-worthy (e.g. a furniture-only scan) —
       * callers fall back to the top-down 3D camera view.
       */
      function fpBuildPlanModel(arrayBuffer) {
        const { json, bin } = fpParseGlbContainer(arrayBuffer);
        const primitives = fpExtractPrimitives(json, bin);
        const buckets = { wall: [], door: [], window: [], opening: [], furniture: [] };
        const floorPoints = [];
        for (const prim of primitives) {
          const kind = fpClassifyName(prim.name);
          if (kind === 'ceiling') continue;
          if (kind === 'floor') {
            floorPoints.push(...prim.points);
            continue;
          }
          if (kind === 'other') continue;
          const rect = fpMinAreaOrientedRect(prim.points);
          if (!rect || !(rect.len > 0.05)) continue;
          buckets[kind].push(rect);
        }
        if (buckets.wall.length < 2) return null;

        // Align: rotate everything so the longest wall is horizontal.
        const longest = buckets.wall.reduce((a, b) => (b.len > a.len ? b : a));
        const alignAngle = -longest.angle;
        const allRects = [...buckets.wall, ...buckets.door, ...buckets.window, ...buckets.opening, ...buckets.furniture];
        let sumX = 0, sumY = 0;
        for (const r of allRects) { sumX += r.cx; sumY += r.cy; }
        const origin = { x: sumX / allRects.length, y: sumY / allRects.length };
        for (const r of allRects) {
          const c = fpRotatePoint({ x: r.cx, y: r.cy }, alignAngle, origin);
          r.cx = c.x;
          r.cy = c.y;
          r.angle += alignAngle;
        }

        // Bounds from wall corners (walls define the plan; furniture never exceeds them
        // in practice, but include it anyway so nothing renders off-canvas).
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const r of allRects) {
          for (const p of fpRectCorners(r)) {
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
          }
        }
        if (!(maxX > minX) || !(maxY > minY)) return null;
        return {
          walls: buckets.wall,
          doors: buckets.door,
          windows: buckets.window,
          openings: buckets.opening,
          furniture: buckets.furniture,
          bounds: { minX, minY, maxX, maxY },
          center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
        };
      }

      // --- SVG blueprint renderer ---------------------------------------------------------

      const FP_UNITS_PER_M = 100; // SVG user units per meter
      const FP_COLORS = {
        wall: '#1f3a54',
        gridMinor: '#edf3fa',
        gridMajor: '#d8e4f1',
        furnitureFill: 'rgba(242, 166, 90, 0.35)',
        furnitureStroke: '#d9913f',
        windowFill: '#cfe4f7',
        dim: '#2b62a8',
        dimStroke: '#3b78c2',
      };
      let fpInstanceCounter = 0;

      function fpSvgEl(tag, attrs) {
        const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
        for (const key in attrs) el.setAttribute(key, attrs[key]);
        return el;
      }

      /** Oriented-rect helper: <rect> centered on the rect, rotated via transform. */
      function fpRectEl(rect, attrs) {
        const M = FP_UNITS_PER_M;
        const el = fpSvgEl('rect', Object.assign({
          x: (rect.cx - rect.len / 2) * M,
          y: (rect.cy - rect.thick / 2) * M,
          width: rect.len * M,
          height: rect.thick * M,
          transform: `rotate(${(rect.angle * 180) / Math.PI} ${rect.cx * M} ${rect.cy * M})`,
        }, attrs));
        return el;
      }

      /** Dimension chip (rounded pill + centered label), sized from the label length. */
      function fpDimChipEl(x, y, label, fontSize) {
        const g = fpSvgEl('g', {});
        const padX = fontSize * 0.55;
        const w = label.length * fontSize * 0.6 + padX * 2;
        const h = fontSize * 1.7;
        g.appendChild(fpSvgEl('rect', {
          x: x - w / 2, y: y - h / 2, width: w, height: h, rx: h / 2,
          fill: '#fff', stroke: FP_COLORS.dimStroke, 'stroke-width': 1,
          'vector-effect': 'non-scaling-stroke',
        }));
        const text = fpSvgEl('text', {
          x, y, fill: FP_COLORS.dim, 'font-size': fontSize, 'font-weight': 700,
          'text-anchor': 'middle', 'dominant-baseline': 'central',
          'font-family': 'inherit',
        });
        text.textContent = label;
        g.appendChild(text);
        return g;
      }

      /** Overall dimension line with end ticks and a centered chip. */
      function fpOverallDimEl(x1, y1, x2, y2, label, fontSize) {
        const g = fpSvgEl('g', {});
        const lineAttrs = {
          stroke: FP_COLORS.dimStroke, 'stroke-width': 1.2, 'vector-effect': 'non-scaling-stroke',
        };
        g.appendChild(fpSvgEl('line', Object.assign({ x1, y1, x2, y2 }, lineAttrs)));
        const tick = fontSize * 0.55;
        const horizontal = Math.abs(y2 - y1) < Math.abs(x2 - x1);
        for (const [px, py] of [[x1, y1], [x2, y2]]) {
          g.appendChild(fpSvgEl('line', Object.assign(
            horizontal
              ? { x1: px, y1: py - tick, x2: px, y2: py + tick }
              : { x1: px - tick, y1: py, x2: px + tick, y2: py },
            lineAttrs
          )));
        }
        g.appendChild(fpDimChipEl((x1 + x2) / 2, (y1 + y2) / 2, label, fontSize));
        return g;
      }

      /** Door glyph: white gap in the wall, jamb ticks, quarter-circle swing arc. */
      function fpDoorEl(rect, planCenter, fontSize) {
        const M = FP_UNITS_PER_M;
        const g = fpSvgEl('g', {});
        // Gap: slightly taller than the wall so the wall reads as fully cut through.
        g.appendChild(fpRectEl(
          { cx: rect.cx, cy: rect.cy, len: rect.len, thick: Math.max(rect.thick * 1.4, 0.14), angle: rect.angle },
          { fill: '#fff' }
        ));
        const dirX = Math.cos(rect.angle), dirY = Math.sin(rect.angle);
        // Swing into the room (toward the plan center).
        const toCenterX = planCenter.x - rect.cx, toCenterY = planCenter.y - rect.cy;
        let normX = -dirY, normY = dirX;
        if (normX * toCenterX + normY * toCenterY < 0) { normX = -normX; normY = -normY; }
        const hingeX = (rect.cx - dirX * rect.len / 2) * M;
        const hingeY = (rect.cy - dirY * rect.len / 2) * M;
        const jambX = (rect.cx + dirX * rect.len / 2) * M;
        const jambY = (rect.cy + dirY * rect.len / 2) * M;
        const leafX = hingeX + normX * rect.len * M;
        const leafY = hingeY + normY * rect.len * M;
        const r = rect.len * M;
        const sweep = (dirX * normY - dirY * normX) > 0 ? 1 : 0;
        g.appendChild(fpSvgEl('path', {
          d: `M ${jambX} ${jambY} A ${r} ${r} 0 0 ${sweep} ${leafX} ${leafY}`,
          fill: 'none', stroke: FP_COLORS.wall, 'stroke-width': 1,
          'vector-effect': 'non-scaling-stroke', 'stroke-dasharray': `${fontSize * 0.35} ${fontSize * 0.35}`,
        }));
        g.appendChild(fpSvgEl('line', {
          x1: hingeX, y1: hingeY, x2: leafX, y2: leafY,
          stroke: FP_COLORS.wall, 'stroke-width': 1.6, 'vector-effect': 'non-scaling-stroke',
        }));
        return g;
      }

      /** Window glyph: light-blue band with a center line (classic double-line window). */
      function fpWindowEl(rect) {
        const g = fpSvgEl('g', {});
        const thick = Math.max(rect.thick, 0.1);
        g.appendChild(fpRectEl({ cx: rect.cx, cy: rect.cy, len: rect.len, thick, angle: rect.angle }, {
          fill: FP_COLORS.windowFill, stroke: FP_COLORS.wall, 'stroke-width': 1,
          'vector-effect': 'non-scaling-stroke',
        }));
        const M = FP_UNITS_PER_M;
        const dirX = Math.cos(rect.angle), dirY = Math.sin(rect.angle);
        g.appendChild(fpSvgEl('line', {
          x1: (rect.cx - dirX * rect.len / 2) * M, y1: (rect.cy - dirY * rect.len / 2) * M,
          x2: (rect.cx + dirX * rect.len / 2) * M, y2: (rect.cy + dirY * rect.len / 2) * M,
          stroke: FP_COLORS.wall, 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke',
        }));
        return g;
      }

      /** Wall-length chip, offset perpendicular from the wall, on the side away from the plan center. */
      function fpWallDimEl(rect, planCenter, fontSize) {
        const M = FP_UNITS_PER_M;
        let normX = -Math.sin(rect.angle), normY = Math.cos(rect.angle);
        const toCenterX = planCenter.x - rect.cx, toCenterY = planCenter.y - rect.cy;
        if (normX * toCenterX + normY * toCenterY > 0) { normX = -normX; normY = -normY; }
        const offsetM = rect.thick / 2 + (fontSize * 1.3) / M;
        const x = (rect.cx + normX * offsetM) * M;
        const y = (rect.cy + normY * offsetM) * M;
        return fpDimChipEl(x, y, `${rect.len.toFixed(2)} m`, fontSize);
      }

      /**
       * Renders the plan model into an <svg> that fills `container`, with drag-to-pan,
       * wheel and pinch zoom (all viewBox-based). Returns the svg element.
       */
      function fpRenderBlueprintSvg(model, container) {
        const M = FP_UNITS_PER_M;
        const b = model.bounds;
        const padM = 1.5; // meters of graph paper around the plan (room for dim chips)
        const fit = {
          x: (b.minX - padM) * M,
          y: (b.minY - padM) * M,
          w: (b.maxX - b.minX + padM * 2) * M,
          h: (b.maxY - b.minY + padM * 2) * M,
        };
        const containerW = container.clientWidth || 320;
        // Labels are authored in SVG units, so size them to read ~11px at fit zoom.
        const fontSize = Math.max(8, (fit.w / containerW) * 11);

        const svg = fpSvgEl('svg', {
          viewBox: `${fit.x} ${fit.y} ${fit.w} ${fit.h}`,
          preserveAspectRatio: 'xMidYMid meet',
          class: 'roomscan-blueprint-svg',
        });
        const instanceId = `fp${++fpInstanceCounter}`;

        // Graph-paper grid: 0.2m minor / 1m major, as userSpaceOnUse patterns so the
        // grid stays glued to plan coordinates while panning/zooming.
        const defs = fpSvgEl('defs', {});
        const minor = fpSvgEl('pattern', {
          id: `${instanceId}-minor`, width: M / 5, height: M / 5, patternUnits: 'userSpaceOnUse',
        });
        minor.appendChild(fpSvgEl('path', {
          d: `M ${M / 5} 0 L 0 0 0 ${M / 5}`, fill: 'none',
          stroke: FP_COLORS.gridMinor, 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke',
        }));
        const major = fpSvgEl('pattern', {
          id: `${instanceId}-major`, width: M, height: M, patternUnits: 'userSpaceOnUse',
        });
        major.appendChild(fpSvgEl('rect', { width: M, height: M, fill: `url(#${instanceId}-minor)` }));
        major.appendChild(fpSvgEl('path', {
          d: `M ${M} 0 L 0 0 0 ${M}`, fill: 'none',
          stroke: FP_COLORS.gridMajor, 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke',
        }));
        defs.appendChild(minor);
        defs.appendChild(major);
        svg.appendChild(defs);

        // Grid backdrop, oversized so it never runs out while panning.
        svg.appendChild(fpSvgEl('rect', {
          x: fit.x - fit.w * 2, y: fit.y - fit.h * 2, width: fit.w * 5, height: fit.h * 5,
          fill: `url(#${instanceId}-major)`,
        }));

        for (const rect of model.walls) {
          svg.appendChild(fpRectEl(rect, { fill: FP_COLORS.wall }));
        }
        for (const rect of model.openings) {
          // Plain pass-through: white gap with a dashed connector.
          svg.appendChild(fpRectEl(
            { cx: rect.cx, cy: rect.cy, len: rect.len, thick: Math.max(rect.thick * 1.4, 0.14), angle: rect.angle },
            { fill: '#fff' }
          ));
          const dirX = Math.cos(rect.angle), dirY = Math.sin(rect.angle);
          svg.appendChild(fpSvgEl('line', {
            x1: (rect.cx - dirX * rect.len / 2) * M, y1: (rect.cy - dirY * rect.len / 2) * M,
            x2: (rect.cx + dirX * rect.len / 2) * M, y2: (rect.cy + dirY * rect.len / 2) * M,
            stroke: FP_COLORS.wall, 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke',
            'stroke-dasharray': `${fontSize * 0.5} ${fontSize * 0.5}`,
          }));
        }
        for (const rect of model.doors) svg.appendChild(fpDoorEl(rect, model.center, fontSize));
        for (const rect of model.windows) svg.appendChild(fpWindowEl(rect));
        for (const rect of model.furniture) {
          svg.appendChild(fpRectEl(rect, {
            fill: FP_COLORS.furnitureFill, stroke: FP_COLORS.furnitureStroke,
            'stroke-width': 1.4, 'vector-effect': 'non-scaling-stroke', rx: 4,
          }));
        }

        // Measurements: per-wall lengths (sub-meter stubs skipped — their chips are wider
        // than the walls themselves and just pile up), then overall width/height as
        // dimension lines outside the plan.
        for (const rect of model.walls) {
          if (rect.len >= 1.0) svg.appendChild(fpWallDimEl(rect, model.center, fontSize));
        }
        const dimOffset = fontSize * 2.6;
        svg.appendChild(fpOverallDimEl(
          b.minX * M, b.minY * M - dimOffset, b.maxX * M, b.minY * M - dimOffset,
          `${(b.maxX - b.minX).toFixed(2)} m`, fontSize
        ));
        svg.appendChild(fpOverallDimEl(
          b.minX * M - dimOffset, b.minY * M, b.minX * M - dimOffset, b.maxY * M,
          `${(b.maxY - b.minY).toFixed(2)} m`, fontSize
        ));

        fpBindPanZoom(svg, fit);
        container.appendChild(svg);
        return svg;
      }

      /** viewBox-based pan (drag), zoom (wheel / two-finger pinch). */
      function fpBindPanZoom(svg, fit) {
        const vb = { x: fit.x, y: fit.y, w: fit.w, h: fit.h };
        const apply = () => svg.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
        const clampZoom = (w) => Math.min(Math.max(w, fit.w / 8), fit.w * 3);

        const clientToSvg = (clientX, clientY) => {
          const rect = svg.getBoundingClientRect();
          return {
            x: vb.x + ((clientX - rect.left) / rect.width) * vb.w,
            y: vb.y + ((clientY - rect.top) / rect.height) * vb.h,
          };
        };
        const zoomAbout = (clientX, clientY, factor) => {
          const focus = clientToSvg(clientX, clientY);
          const newW = clampZoom(vb.w * factor);
          const scale = newW / vb.w;
          vb.x = focus.x - (focus.x - vb.x) * scale;
          vb.y = focus.y - (focus.y - vb.y) * scale;
          vb.w = newW;
          vb.h *= scale;
          apply();
        };

        svg.addEventListener('wheel', (event) => {
          event.preventDefault();
          zoomAbout(event.clientX, event.clientY, Math.exp(event.deltaY * 0.002));
        }, { passive: false });

        const pointers = new Map();
        let pinchStartDist = 0;
        let pinchStartW = 0;
        svg.addEventListener('pointerdown', (event) => {
          svg.setPointerCapture(event.pointerId);
          pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
          if (pointers.size === 2) {
            const [a, c] = [...pointers.values()];
            pinchStartDist = Math.hypot(a.x - c.x, a.y - c.y);
            pinchStartW = vb.w;
          }
        });
        svg.addEventListener('pointermove', (event) => {
          const prev = pointers.get(event.pointerId);
          if (!prev) return;
          const curr = { x: event.clientX, y: event.clientY };
          if (pointers.size === 1) {
            const rect = svg.getBoundingClientRect();
            vb.x -= ((curr.x - prev.x) / rect.width) * vb.w;
            vb.y -= ((curr.y - prev.y) / rect.height) * vb.h;
            apply();
          }
          pointers.set(event.pointerId, curr);
          if (pointers.size === 2 && pinchStartDist > 0) {
            const [a, c] = [...pointers.values()];
            const dist = Math.hypot(a.x - c.x, a.y - c.y);
            if (dist > 0) {
              const midX = (a.x + c.x) / 2, midY = (a.y + c.y) / 2;
              const targetW = clampZoom(pinchStartW * (pinchStartDist / dist));
              zoomAbout(midX, midY, targetW / vb.w);
            }
          }
        });
        const endPointer = (event) => {
          pointers.delete(event.pointerId);
          if (pointers.size < 2) pinchStartDist = 0;
        };
        svg.addEventListener('pointerup', endPointer);
        svg.addEventListener('pointercancel', endPointer);
      }

      // --- Mount / unmount (called by the 2D toggle in listing-detail-roomscan.js) --------

      // One parse per GLB URL per page: the fetch itself is normally served from the
      // browser's HTTP cache (model-viewer already downloaded the same URL), and the
      // extracted plan model is reused across inline tile / fullscreen / re-toggles.
      const fpPlanModelPromises = new Map();

      function fpGetPlanModel(glbUrl) {
        if (!fpPlanModelPromises.has(glbUrl)) {
          const promise = fetch(glbUrl)
            .then((res) => {
              if (!res.ok) throw new Error(`GLB fetch failed: ${res.status}`);
              return res.arrayBuffer();
            })
            .then((buffer) => fpBuildPlanModel(buffer));
          // Allow a retry on transient network failure rather than caching the rejection.
          promise.catch(() => fpPlanModelPromises.delete(glbUrl));
          fpPlanModelPromises.set(glbUrl, promise);
        }
        return fpPlanModelPromises.get(glbUrl);
      }

      /**
       * Mounts the blueprint overlay into `host` (the inline viewer wrap or the
       * fullscreen backdrop). Resolves to true when the blueprint rendered, false when
       * the scan has no plan-worthy geometry or parsing failed — callers keep the
       * top-down 3D camera view as the fallback in that case.
       */
      async function mountRoomScanBlueprint(host, glbUrl) {
        let overlay = host.querySelector(':scope > .roomscan-blueprint');
        if (overlay) {
          overlay.hidden = false;
          host.classList.add('is-blueprint');
          return true;
        }
        overlay = document.createElement('div');
        overlay.className = 'roomscan-blueprint';
        overlay.innerHTML = '<span class="loading-spinner roomscan-loading-spinner" aria-hidden="true"></span>';
        host.appendChild(overlay);
        host.classList.add('is-blueprint');
        try {
          const model = await fpGetPlanModel(glbUrl);
          if (!model) throw new Error('no plan-worthy geometry');
          // The user may have toggled back to 3D while we were parsing.
          if (!overlay.isConnected) return false;
          overlay.innerHTML = '';
          fpRenderBlueprintSvg(model, overlay);
          return true;
        } catch (err) {
          console.warn('2D blueprint unavailable, falling back to top-down 3D', err);
          overlay.remove();
          host.classList.remove('is-blueprint');
          return false;
        }
      }

      /** Hides the blueprint overlay (kept in the DOM for instant re-toggles). */
      function unmountRoomScanBlueprint(host) {
        const overlay = host.querySelector(':scope > .roomscan-blueprint');
        if (overlay) overlay.hidden = true;
        host.classList.remove('is-blueprint');
      }
