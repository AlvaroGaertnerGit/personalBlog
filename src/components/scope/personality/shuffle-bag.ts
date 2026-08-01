// SPR-011 (the "trust" touch interaction, refined) — a "bag randomizer":
// shuffle a small pool once, hand items out one at a time with no repeats,
// only reshuffle once the bag empties. This is deliberately NOT plain
// Math.random() selection — true randomness can (and eventually will) pick
// the same item twice in a row, which reads as "the same animation played
// again," not "a character with a small variety of behaviours." A visitor
// should subconsciously feel "I haven't seen him do that before," without
// ever consciously noticing why.
//
// Guards the one gap a naive bag randomizer still has: nothing stops a
// fresh reshuffle from putting the just-played item first, which would
// still read as an immediate repeat straddling the reshuffle boundary. A
// single swap, only ever applied when it would actually have repeated,
// closes that gap without otherwise touching the shuffle's distribution.
function shuffle<T>(items: readonly T[]): T[] {
  const shuffled = [...items]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

interface ShuffleBag<T> {
  /** The next item — refills and reshuffles automatically once empty. */
  next(): T
  /**
   * Empties the queue for a fresh shuffle order — but deliberately does
   * NOT forget the last-played item. In practice `next()` is only ever
   * called once before something resets the bag (a touch interaction's own
   * familiarity always advances past this stage after one play, so a
   * second draw from the same fill only happens across a reset), which
   * means the reshuffle-boundary guard above is the ONLY thing standing
   * between "a visitor sees the same reaction twice in a row" and not —
   * if reset() cleared `lastPlayed` too, a fresh shuffle could freely place
   * the very item that just played first, defeating the entire point.
   */
  reset(): void
}

function createShuffleBag<T>(items: readonly T[]): ShuffleBag<T> {
  let bag: T[] = []
  let lastPlayed: T | undefined

  function refill() {
    bag = shuffle(items)
    if (bag.length > 1 && bag[0] === lastPlayed) {
      ;[bag[0], bag[1]] = [bag[1], bag[0]]
    }
  }

  return {
    next() {
      if (bag.length === 0) refill()
      const item = bag.shift() as T
      lastPlayed = item
      return item
    },
    reset() {
      bag = []
    },
  }
}

export { createShuffleBag }
export type { ShuffleBag }
