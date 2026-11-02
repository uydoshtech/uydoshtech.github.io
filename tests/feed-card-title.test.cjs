const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

const source = fs.readFileSync('assets/telegram-feed.js', 'utf8');
const start = source.indexOf('const FEED_ID_TITLE');
const end = source.indexOf('function listingCardHtml');
const context = vm.createContext({});
vm.runInContext(`${source.slice(start, end)}\nthis.feedCardTitle = feedCardTitle;`, context);

test('an id title becomes a sentence with the room count from the post', () => {
  const title = context.feedCardTitle({
    title: '🆔 ID: 1453',
    description: '🏠 СДАЁТСЯ | 1-КОМНАТНАЯ\n🛏 Количество комнат: 1\n💰 ЦЕНА: 600 у.е.',
  });
  assert.equal(title, 'Сдаётся 1-комнатная квартира');
});

test('a four-room post does not reuse the one-room sentence', () => {
  const title = context.feedCardTitle({
    title: 'ID: 9',
    description: 'СДАЁТСЯ | 4-КОМНАТНАЯ\nКоличество комнат: 4',
  });
  assert.equal(title, 'Сдаётся 4-комнатная квартира');
});

test('Количество комнат wins when it disagrees with the headline adjective', () => {
  const title = context.feedCardTitle({
    title: '🆔 ID: 8',
    description: 'СДАЁТСЯ | 2-КОМНАТНАЯ\nКоличество комнат: 3',
  });
  assert.equal(title, 'Сдаётся 3-комнатная квартира');
});

test('an ordinary title stays as written', () => {
  assert.equal(context.feedCardTitle({ title: 'Комната у метро', description: 'Количество комнат: 1' }), 'Комната у метро');
});
