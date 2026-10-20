import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  getIstanbulDateParts,
  getProgrammePosition,
  getDisplayDate,
  getWeekDates,
  getShowForDate,
  millisecondsUntilRefresh,
} from '../dist/program.mjs';

const programme = JSON.parse(
  await readFile(new URL('../dist/program.json', import.meta.url), 'utf8'),
);

test('the two-week cycle begins on Monday 13 July 2026', () => {
  const firstMonday = getProgrammePosition('2026-07-13', programme.cycleStartDate);
  const secondMonday = getProgrammePosition('2026-07-20', programme.cycleStartDate);
  assert.equal(firstMonday.weekIndex, 0);
  assert.equal(firstMonday.dayIndex, 0);
  assert.equal(secondMonday.weekIndex, 1);
  assert.equal(secondMonday.dayIndex, 0);
});

test('20 October 2026 uses the first programme week and Tuesday', () => {
  const position = getProgrammePosition('2026-10-20', programme.cycleStartDate);
  assert.equal(position.weekIndex, 0);
  assert.equal(position.dayIndex, 1);
  const show = getShowForDate(programme, '2026-10-20');
  assert.equal(show.title, 'Bonnles');
  assert.equal(show.date, '2026-10-20');
  assert.equal(show.isSpecial, false);
});

test('Istanbul date parts cross midnight at 21:00 UTC', () => {
  const before = getIstanbulDateParts(new Date('2026-10-20T20:59:00Z'));
  const after = getIstanbulDateParts(new Date('2026-10-20T21:00:00Z'));
  assert.deepEqual(
    [before.year, before.month, before.day, before.hour, before.minute],
    [2026, 10, 20, 23, 59],
  );
  assert.deepEqual(
    [after.year, after.month, after.day, after.hour, after.minute],
    [2026, 10, 21, 0, 0],
  );
});

test('the displayed date changes at Istanbul midnight', () => {
  assert.equal(getDisplayDate(new Date('2026-10-20T20:59:59Z')), '2026-10-20');
  assert.equal(getDisplayDate(new Date('2026-10-20T21:00:00Z')), '2026-10-21');
});

test('the 22:30 refresh does not advance the displayed date or show', () => {
  for (const instant of [
    '2026-10-20T19:29:59Z',
    '2026-10-20T19:30:00Z',
    '2026-10-20T19:30:01Z',
    '2026-10-20T20:59:59Z',
  ]) {
    const displayDate = getDisplayDate(new Date(instant));
    assert.equal(displayDate, '2026-10-20', instant);
    assert.equal(getShowForDate(programme, displayDate).title, 'Bonnles', instant);
  }
});

test('the displayed week runs from Monday 19 to Sunday 25 October', () => {
  const expected = [
    '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22',
    '2026-10-23', '2026-10-24', '2026-10-25',
  ];
  assert.deepEqual(getWeekDates('2026-10-20'), expected);
  assert.deepEqual(getWeekDates('2026-10-19'), expected);
  assert.deepEqual(getWeekDates('2026-10-25'), expected);
});

test('the next Monday starts a new week across the month boundary', () => {
  assert.deepEqual(getWeekDates('2026-11-01'), [
    '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29',
    '2026-10-30', '2026-10-31', '2026-11-01',
  ]);
});

test('Oktoberfest replaces Diva Nova on its exact date, 23 October 2026', () => {
  const show = getShowForDate(programme, '2026-10-23');
  assert.equal(show.title, 'Oktoberfest');
  assert.equal(show.poster, 'event-oktoberfest-2026.jpg');
  assert.equal(show.date, '2026-10-23');
  assert.equal(show.weekIndex, 0);
  assert.equal(show.dayIndex, 4);
  assert.equal(show.isSpecial, true);
  assert.equal(getShowForDate(programme, '2026-10-22').isSpecial, false);
  assert.equal(getShowForDate(programme, '2026-10-24').isSpecial, false);
});

test('the next first-week Friday returns to Diva Nova', () => {
  const show = getShowForDate(programme, '2026-11-06');
  assert.equal(show.title, 'Diva Nova');
  assert.equal(show.poster, 'show-week1-diva-nova.jpg');
  assert.equal(show.weekIndex, 0);
  assert.equal(show.dayIndex, 4);
  assert.equal(show.isSpecial, false);
});

test('30 October uses the second-week Friday SHOW TIME programme', () => {
  const show = getShowForDate(programme, '2026-10-30');
  assert.equal(show.title, 'SHOW TIME');
  assert.equal(show.poster, 'show-week2-friday-show-time.jpg');
  assert.equal(show.weekIndex, 1);
  assert.equal(show.dayIndex, 4);
  assert.equal(show.isSpecial, false);
});

test('both programme weeks use live music on Sunday', () => {
  for (const date of ['2026-10-25', '2026-11-01']) {
    const show = getShowForDate(programme, date);
    assert.equal(show.title, 'Canlı Müzik', date);
    assert.equal(show.poster, 'show-sunday-live-music.jpg', date);
    assert.equal(show.dayIndex, 6, date);
    assert.equal(show.isSpecial, false, date);
  }
});

test('the daily refresh waits one minute at Istanbul 22:29', () => {
  assert.equal(millisecondsUntilRefresh(new Date('2026-10-20T19:29:00Z')), 60_000);
});

test('after Istanbul 22:30, refresh is scheduled for the following evening', () => {
  assert.equal(
    millisecondsUntilRefresh(new Date('2026-10-20T19:30:01Z')),
    86_399_000,
  );
});

test('at exactly Istanbul 22:30, the next refresh is a full day away', () => {
  assert.equal(
    millisecondsUntilRefresh(new Date('2026-10-20T19:30:00Z')),
    86_400_000,
  );
});
