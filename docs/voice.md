# How CloudsForge writes

One voice across seventeen surfaces, so a reader who moves from the marketing site to the wallet to
the explorer feels they are still in the same place.

This is part of the design system for the same reason the type scale is: a product that looks
consistent and reads like it was written by five different people is not consistent. If you are
changing user-facing text anywhere in the estate, this file is the standard.

---

## The voice in one line

**Write like a knowledgeable colleague explaining something to another adult who is busy.**

Professional, plain, warm. Not chatty, not corporate, not clever. The reader is capable and short of
time; respect both.

---

## The five rules

### 1. Say what it does before you say how it works

Lead with what the reader gets. The mechanism is the second sentence, not the first.

> **Before** — "Homefire is memory-hard and CPU-friendly: each attempt fills a scratchpad by chaining
> SHA-256, then takes a pseudo-random walk that reads and rewrites it."
>
> **After** — "Mining works on the computer you already have. The puzzle is built to lean on memory
> speed rather than raw processing power, so a warehouse of specialist hardware earns barely more per
> pound than a laptop."

The first tells you the implementation and leaves you to infer the point. The second tells you the
point and then earns it.

### 2. Never claim newness, youth, or a date

This is a standing instruction from the owner and it has no exceptions.

Banned outright: *new*, *brand new*, *young*, *unproven*, *early*, *recently*, *so far*, *as of
&lt;date&gt;*, *at the time of writing*, *days old*, *just launched*, *coming soon*.

Two reasons. Advertising immaturity talks a reader out of trusting the product, and a sentence
pinned to a date is wrong from the day after it is written and nobody ever goes back for it.

> **Before** — "Its mainnet and testnet both answer on public endpoints and are new enough to be
> unproven, and no EMBER on either has any monetary value."
>
> **After** — "Mainnet and testnet both answer on public endpoints. EMBER carries no monetary value
> on either, and nothing here is an offer to buy or sell."

The honest caveat survives. The apology for existing does not.

### 3. Write sentences a person would say out loud

Second person. Active voice. Ordinary words. If you would not say it to someone standing next to
you, do not ship it.

- "You can" — not "users are able to"
- "we hold" — not "the platform custodies"
- "goes wrong" — not "results in a failure condition"
- "costs" — not "incurs a charge of"

Contractions are fine where they sound natural. Being stiff is not the same as being professional.

### 4. One idea per sentence, one job per paragraph

The estate's habit is a single sentence carrying a claim, its justification, its exception and a
citation. Split it. A reader should never have to re-read to find the verb.

Aim for under 25 words a sentence, under four sentences a paragraph. Where a caveat matters, give it
its own sentence — it is more likely to be read there than buried behind a semicolon.

### 5. Be specific, and never oversell

Concrete beats grand. "Deposits are credited after twelve blocks" beats "industry-leading settlement
assurance". If there is a real limitation a reader would want to know before committing money, say
it plainly, once, in its own sentence — and then stop. State it; do not dwell on it.

---

## Words we do not use

**Marketing filler:** revolutionary, seamless, cutting-edge, next-generation, unlock, empower,
leverage, robust, powerful, world-class, best-in-class, effortless, delightful, game-changing.

**Crypto filler:** to the moon, degen, ape, HODL, WAGMI, alpha, based, gm.

**Hedging that means nothing:** essentially, basically, simply, just, actually, arguably, quite,
very, really.

**Jargon without a translation:** if a term of art is genuinely the right word — *reorg*, *nonce*,
*idempotency key* — use it and define it in the same breath, once, the first time it appears on that
surface.

---

## Tone by surface

Same voice throughout; the register shifts with the stakes.

| Where | Register |
| --- | --- |
| Marketing site, product landing pages | Warmest. Confident, welcoming, plain. |
| Wallet, trading, payments — anything touching money | Precise and calm. No jokes near a balance. |
| Explorer, status, developer docs | Factual and dense, still in sentences, still human. |
| Errors and empty states | Kind and specific. See below. |
| Admin and operator consoles | Direct and unadorned. The reader is a colleague at work. |

---

## Errors, empty states and confirmations

These are where writing does the most work and gets the least attention.

**An error says what happened, whether anything was lost, and what to do next.** Never blame the
reader, never expose an internal code as the whole message, never say "something went wrong" when
you know what went wrong.

> **Before** — "Request failed with status 402: insufficient_balance"
>
> **After** — "There isn't enough EMBER in your wallet to cover this. Nothing was sent. Add funds
> and try again — the amount and address you entered are still here."

**An empty state explains why it is empty and what fills it.**

> **Before** — "No results."
>
> **After** — "No backtests yet. Run a strategy against a price series and the results will collect
> here."

**A confirmation says exactly what is about to happen and what cannot be undone**, in that order,
before the button.

---

## Before you call it done

- Read it aloud. If you run out of breath or stumble, rewrite it.
- Search for the banned words above, and for any date.
- Check nothing promises a thing the product does not do today.
- Check a caveat that matters is still there — clarity is not the same as omission.
- Look at it in both colour schemes. Copy that only reads well on one is not finished.
