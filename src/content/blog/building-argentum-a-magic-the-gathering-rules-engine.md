---
title: "How I built a Magic: The Gathering game client in two weeks"
date: 2026-02-02
excerpt: "Magic: The Gathering has over 28,000 unique cards. Each one can interact with every other in ways the designers never anticipated. The comprehensive rules document is over 200 pages long. I decided to build an engine that implements all of it. And I barely wrote any code myself."
tags: ["board games", "programming", "AI"]
cover: "/blog/building-argentum-a-magic-the-gathering-rules-engine/cover.webp"
shelf: games
---

> ***Update, 2 October 2026:*** *This post is about the first two weeks. Eight months later, Argentum is a lot bigger, and I'm no longer building it alone. [Where it stands now](#where-it-stands-now-october-2026).*

It started with a friend mentioning it would be fun to run draft tournaments online. MTG Arena doesn't support private tournaments—you can play against each other, but organizing an actual draft pod with friends and running a bracket? Not happening.

So I figured: how hard could it be?

Around the same time, I'd been curious how well AI coding agents actually perform on complex projects. Claude Code had been getting a lot of praise, and this seemed like the perfect test case. Magic: The Gathering has over 28,000 unique cards, each able to interact with every other in ways the designers never anticipated. The comprehensive rules document is over 200 pages long.

I sat down and estimated the effort. Without AI assistance, building a complete platform—SDK, card sets, rules engine, game server, web frontend, deployment pipeline—would easily be a 6-month hobby project. Probably more, given the notorious complexity of MTG's rules. The layer system alone could eat a month.

A week and a half later, I had a working solution.

41,000 lines of Kotlin. 12,000 lines of TypeScript. A functional draft system. Real-time multiplayer. And it plays Magic—correctly. The layer system handles Humility. Triggered abilities stack in APNAP order. State-based actions cascade properly.

This was the moment it really hit me how fast this technology is moving.

<figure>
<img src="/blog/building-argentum-a-magic-the-gathering-rules-engine/image-1.webp" alt="" loading="lazy" />
<figcaption>The game engine at work</figcaption>
</figure>

## What Vibe Coding Actually Looks Like

I barely wrote any code myself. Instead, I guided the process—describing what I wanted, reviewing what came back, course-correcting when the implementation drifted. Think of it as pair programming where your partner types 50x faster than you but needs you to keep the big picture in focus.

To keep Claude aligned with my vision, I set up a `docs` folder containing guidance on architecture decisions, coding style, and design principles. From these docs, I generated a `CLAUDE.md` file—a dedicated instruction set that Claude Code reads automatically—and kept it up-to-date as the project evolved. This upfront investment paid off continuously: Claude would follow established patterns without me having to repeat myself.

What I loved most was plan mode. Before Claude starts building anything significant, it asks clarifying questions: "How should this interact with existing triggers? Should the effect be optional? What happens if there are no valid targets?" Then it forms a concrete plan and waits for approval. This back-and-forth is invaluable. Half the bugs in software come from misunderstood requirements—plan mode surfaces those misunderstandings before any code gets written.

For architecture reviews, I'd occasionally pull in Gemini. With its million-token context window, I could dump the entire codebase into a single request and ask "does this structure make sense?" or "what am I missing?" The combination works well: Claude Code for the building, Gemini for the birds-eye sanity checks.

The result is a codebase I understand deeply—because I co-designed it—but didn't have to type out line by line. Would I have finished this project without AI assistance? Probably not. It would have joined the graveyard of ambitious side projects that never quite made it.

## The Problem

The intuiting might be to take the obvious approach: model cards as class hierarchies. A Creature extends Permanent, which extends Card. Simple, intuitive, wrong.

The problem is that in Magic, a card's identity is fluid. That creature you control? An opponent can steal it. That instant in your hand? It might be a creature on the battlefield (thanks, Zoetic Cavern). That 2/2 bear? With the right enchantments, it's now a 7/7 flying artifact creature with lifelink.

Object-oriented inheritance can't handle this. You can't re-parent an object at runtime. So most engines end up with sprawling conditional logic, special cases, and inevitable bugs when two obscure cards interact in ways nobody tested.

## Starting Simple

I started with Portal, the simplified beginner set from 1997. No instants (well a few, but they weren't called instants yet), few activated abilities, mostly just creatures and sorceries. A manageable scope to get the core engine working before tackling the full comprehensive rules.

There's something fitting about that. Portal was how I started playing Magic when I was 8 years old. Now, decades later, it became the foundation for building an engine that handles the full complexity of the game.

Once Portal worked—creatures attacking, sorceries resolving, life totals tracking—the architecture proved solid enough to layer on the rest. The stack. Triggered abilities. Replacement effects. The infamous layer system.

## The Full Stack

The project splits into cleanly separated modules, each with a single responsibility:

### The SDK

The SDK defines the vocabulary—what a card is, what effects exist, what costs mean. It's pure data structures and a DSL for defining cards. No game logic, no dependencies.

Think of it as the shared language that card definitions and the engine both speak. It provides the building blocks: mana costs, target filters, effect types, duration modifiers:

```kotlin
// The Effects facade - card definitions compose these primitives
Effects.DealDamage(3)                    // Bolt something
Effects.DrawCards(2)                     // Blue's favorite
Effects.GainLife(5)                      // White's thing
Effects.Destroy(EffectTarget.AnyTarget)  // Removal
Effects.ReturnToHand(target)             // Bounce
Effects.ModifyStats(4, 4, Duration.EndOfTurn)  // Pump spell
```

The SDK is deliberately minimal. It describes the "what" without the "how". A card has a mana cost, a type line, and abilities. An effect has a target and a duration. That's it. The actual game logic lives elsewhere.

### The Card Sets

The card sets use that DSL to define actual cards. Portal, Alpha, custom sets—they're all just data. Each card is a declarative description of what it does:

```kotlin
val MonstrousGrowth = card("Monstrous Growth") {
    manaCost = "{1}{G}"
    typeLine = "Sorcery"

    spell {
        target = TargetCreature(filter = CreatureTargetFilter.Any)
        effect = ModifyStatsEffect(
            powerModifier = 4,
            toughnessModifier = 4,
            target = EffectTarget.ContextTarget(0)
        )
    }
}
```

Triggered abilities work the same way:

```kotlin
val ManOWar = card("Man-o'-War") {
    manaCost = "{2}{U}"
    typeLine = "Creature — Jellyfish"
    power = 2
    toughness = 2

    triggeredAbility {
        trigger = OnEnterBattlefield()
        target = TargetCreature()
        effect = ReturnToHandEffect(EffectTarget.ContextTarget(0))
    }
}
```

Traditional engines hardcode card logic. Want to add a new card? Write a new class, handle all its edge cases, hope you didn't break something else.

Argentum treats cards as pure data. The engine doesn't know about Monstrous Growth specifically. It knows how to create continuous effects. It knows how to handle targets. The card definition just connects these primitives. Adding new cards rarely requires engine changes.

Adding a new set means writing card definitions, nothing more. The sets don't know how the game works; they just describe what cards do.

### The Rules Engine

The rules engine is the brain. Pure Kotlin, zero server dependencies. This is where the comprehensive rules live: the stack, priority system, combat phases, triggered abilities, state-based actions, replacement effects, and the layer system.

**Entity-Component-System Architecture**

Instead of class hierarchies, Argentum uses pure ECS. Everything is an entity—just a unique ID. Cards, players, spells on the stack, even continuous effects like "Giant Growth gave this +3/+3 until end of turn." All entities.

Each entity is defined by its components: pure data bags with no behavior. A creature on the battlefield might have components marking it as tapped, tracking its controller, counting its +1/+1 counters. The entity doesn't "know" it's tapped. It simply has—or doesn't have—that data attached.

All logic lives in systems. The action processor takes a game state and an action, then returns a new state plus events:

```
(GameState, GameAction) → ExecutionResult(GameState, List<GameEvent>)
```

The state is immutable. Every game action creates a fresh snapshot, which makes replay, undo, and network sync trivial. Completely deterministic: two identical inputs always produce identical outputs.

**The Layer System**

Here's where it gets interesting. When multiple effects modify a permanent, they apply in a specific order across seven layers:

1. **Copy effects** (Clone becomes a copy of target creature)
2. **Control-changing effects** (Mind Control steals a creature)
3. **Text-changing effects** (Magical Hack changes "swamp" to "island")
4. **Type-changing effects** (Blood Moon makes nonbasic lands Mountains)
5. **Color-changing effects** (Painter's Servant makes everything blue)
6. **Ability-adding/removing effects** (Glorious Anthem gives creatures +1/+1)
7. **Power/toughness effects** (with five sublayers: setting, modifying, counters, switching)

Get the order wrong and your engine produces incorrect game states.

Argentum separates "base state" from "projected state." The base state is what's stored—the permanent as it exists without modifications. The state projector calculates what players actually see by applying all active continuous effects in the correct layer order.

This separation is crucial. When an effect ends (Giant Growth wears off at end of turn), you don't need to "undo" anything—just remove the effect from the list and recalculate. The base state never changed.

The tricky part is dependencies. Sometimes effect A changes whether effect B applies, which might change whether effect A applies. Consider Humility (makes all creatures 1/1 with no abilities) and Opalescence (makes enchantments into creatures). If Humility is an enchantment... does it affect itself?

Argentum handles this with a trial application system—apply effects tentatively, detect when one effect's outcome depends on another's application, establish the dependency order, then apply for real. It's the kind of edge case that breaks most MTG engines. Argentum handles it correctly.

Because the engine is completely deterministic and has no I/O, testing is straightforward. Feed it a state and an action, verify the output. No mocking, no flakiness.

### The Game Server

The game server wraps the engine for online play. It handles WebSocket connections, manages concurrent game sessions, authenticates players via JWT, and—critically—filters hidden information.

The engine produces a complete game state including everyone's hands and library order. The server ensures each player only sees what they're entitled to see:

```kotlin
private fun isZoneVisibleTo(zoneKey: ZoneKey, viewingPlayerId: EntityId): Boolean {
    return when (zoneKey.zoneType) {
        ZoneType.LIBRARY -> false  // Hidden from everyone
        ZoneType.HAND -> zoneKey.ownerId == viewingPlayerId  // Only owner sees
        ZoneType.BATTLEFIELD,
        ZoneType.GRAVEYARD,
        ZoneType.STACK,
        ZoneType.EXILE -> true  // Public zones
    }
}
```

Your opponent's hand stays hidden. Scry effects only reveal cards to the player who scryed. The engine can stay pure while the server handles the messy real-world concerns.

The server module also houses scenario tests—integration tests that simulate actual gameplay with player inputs and outputs. These tests verify that cards interact correctly in realistic situations: casting spells, responding to triggers, making decisions. When a new card is added, a scenario test ensures it behaves correctly in context, not just in isolation.

### The Web Client

The web client follows what we call the "dumb terminal" pattern. It renders the game state it receives. It captures user intent through clicks. That's it.

```typescript
submitAction: (action) => {
    ws?.send(createSubmitActionMessage(action))
    set({ selectedCardId: null, targetingState: null })
}
```

When you tap a creature, the client doesn't validate whether it's summoning sick or whether you control it—it just sends "player wants to tap this entity" to the server. The server checks legality using the engine, updates state, broadcasts the result.

This eliminates an entire class of bugs where client and server disagree about game rules. If the rules change, you only update the engine. The client stays blissfully ignorant, just visualizing state and forwarding actions.

Each layer stays focused. The engine doesn't know about networking. The server doesn't know about React. The client doesn't know the rules.

## Why Build This?

Because I like challenges and I like playing Magic. The comprehensive rules are a 30-year accretion of edge cases that somehow still form a coherent system—exactly the kind of puzzle I can't resist.

Without AI assistance, this would have stayed on my "someday" list forever. Instead, it's live. The layer system handles Humility correctly. Triggered abilities fire in the right order. You can actually draft with friends.

The engine is open source at [github.com/wingedsheep/argentum-engine](https://github.com/wingedsheep/argentum-engine). Play at [magic.wingedsheep.com](https://magic.wingedsheep.com/).

## Where it stands now (October 2026)

When I wrote this post, Argentum had Portal and the start of Onslaught: 231 cards. Eight months later:

| | February 2026 | October 2026 |
|---|---|---|
| Distinct cards | 231 | about 14,500 |
| Complete sets | 1 | 39 |
| Production code | about 81,000 lines | about 1.37 million lines |
| Tests | about 400 | about 21,600 |
| Commits | 468 | 14,400 |
| Contributors | 1 | 13 |

<figure class="chart" role="img" aria-label="Lines of production code per part, February and October 2026">
<div class="chart-key"><span><i style="--key:var(--page-ink)"></i>February</span><span><i style="--key:var(--page-accent)"></i>October</span></div>
<div class="bars">
<span>Card sets</span><span class="bar" style="--now:1.000;--then:0.009" title="Card sets: 7.9k in February, 855.3k in October"></span><span>855k</span>
<span>Rules engine</span><span class="bar" style="--now:0.241;--then:0.029" title="Rules engine: 24.8k in February, 205.7k in October"></span><span>206k</span>
<span>Web client</span><span class="bar" style="--now:0.128;--then:0.028" title="Web client: 23.6k in February, 109.5k in October"></span><span>110k</span>
<span>SDK</span><span class="bar" style="--now:0.092;--then:0.015" title="SDK: 12.7k in February, 78.8k in October"></span><span>79k</span>
<span>Game server</span><span class="bar" style="--now:0.042;--then:0.014" title="Game server: 12.3k in February, 35.5k in October"></span><span>36k</span>
<span>Other tooling</span><span class="bar" style="--now:0.036;--then:0.000" title="Other tooling: new since February, 30.5k in October"></span><span>30k</span>
<span>Argentum Assay</span><span class="bar" style="--now:0.034;--then:0.000" title="Argentum Assay: new since February, 29.2k in October"></span><span>29k</span>
<span>AI opponents</span><span class="bar" style="--now:0.029;--then:0.000" title="AI opponents: new since February, 24.6k in October"></span><span>25k</span>
</div>
<figcaption>Lines of production code per part, not counting tests. The card sets are mostly declarative card data.</figcaption>
</figure>

Most of the code is card data, about 855,000 lines of it, and most of the test code is a scenario test for each card. The cards came in faster as the engine learned more of Magic's vocabulary: about 3,100 by June, 7,000 by July, 12,900 by September. The complete sets run from Arabian Nights and Antiquities to Reality Fracture, which came out today.

<figure class="chart" role="img" aria-label="Distinct cards implemented: 226 on 1 February, 3,130 on 1 June, 7,002 on 1 July, about 14,480 on 2 October">
<div class="cols">
<div class="col" style="--v:0.015" title="1 February: 226 cards"><b>226</b></div>
<div class="col" style="--v:0.055" title="1 March: 831 cards"></div>
<div class="col" style="--v:0.100" title="1 April: 1,496 cards"></div>
<div class="col" style="--v:0.123" title="1 May: 1,838 cards"></div>
<div class="col" style="--v:0.209" title="1 June: 3,130 cards"><b>3,130</b></div>
<div class="col" style="--v:0.467" title="1 July: 7,002 cards"><b>7,002</b></div>
<div class="col" style="--v:0.553" title="1 August: 8,294 cards"></div>
<div class="col" style="--v:0.861" title="1 September: 12,916 cards"></div>
<div class="col" style="--v:0.965" title="2 October: 14,480 cards"><b>14,480</b></div>
</div>
<div class="col-axis"><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span><span>Jul</span><span>Aug</span><span>Sep</span><span>Oct</span></div>
<figcaption>Distinct cards in Argentum at the start of each month. Hover a column for its number.</figcaption>
</figure>

**What you can play.** Booster, Winston, Grid and cube drafts, sealed, and tournaments. Commander, and Commander draft. Free-for-All for up to six players, Two-Headed Giant, team against team, and Momir Basic. There are accounts, friends, ranked play with an Elo rating per mode, replays, and a Learn to Play course with four coached games. The opponent you play against is either a built-in AI that searches a few moves ahead, or a language model.

**What's new under the hood.** A gym wraps the engine for reinforcement learning, with self-play through Monte Carlo tree search. And there's Argentum Assay, which reads a card's Oracle text into the SDK and prints it back out. It only counts a reading as right when the text comes back word for word. It reads about 10,200 of Magic's 34,900 cards whole, and by comparing its readings with the hand-written cards it has found real bugs in those.

**It's not just me anymore.** Bjørn-Olav Strand joined in April and has made about 2,700 commits since, implementing whole sets and doing a lot of the work on the rules engine and the SDK. About a dozen others have contributed too, and roughly 400 pull requests have come in from people's own forks. Want to join in? There's a [Discord](https://discord.gg/dy6eSRPWzu).

**How it gets built now.** I still barely write code myself. About 86% of the commits are co-authored with Claude, moving up a model every month or two, from Opus 4.5 in January to Opus 5.5 now. What changed is how the work is organised. A new set starts with a gap analysis: which cards need things the engine can't do yet. Those features get designed and built first. Then agents implement the cards in parallel, each as its own pull request with a test, and anything that touches the engine gets reviewed. A loop can now run a whole set like this, one reviewed pull request at a time. The instructions moved from `CLAUDE.md` to `AGENTS.md` so other agents can follow them as well.

The agentic loop can now keep going 24/7. It picks up work, implements it, runs the tests, works through review, and moves on to the next card. That changes the rhythm of the project: progress can continue while I'm asleep or doing something else, without me having to start every task by hand. The tests and reviews matter even more when the loop can keep going all night. A mistake in a shared rule can affect hundreds of cards.

<figure class="chart">
<ol class="flow">
<li><strong>Gap analysis</strong><small>Which cards in the set need something the engine can't do yet?</small></li>
<li><strong>Design and build the missing features</strong><small>New rules in the engine and new words in the SDK, each with tests.</small></li>
<li><strong>Agents implement the cards in parallel</strong><small>Each card gets a scenario test and its own pull request.</small><span class="prs"><span>PR · card</span><span>PR · card</span><span>PR · card</span><span>PR · card</span><span>…</span></span></li>
<li><strong>Review</strong><small>Anything that touches the engine or the SDK is reviewed before it merges.</small></li>
</ol>
<p class="flow-loop">↻ the loop can run 24/7, one reviewed pull request at a time, until the set is done</p>
<figcaption>How a new set gets built now</figcaption>
</figure>

**What it took.** In February I guessed this would be a six-month hobby project without AI. That was optimistic. Going by commit times, all of us together have put in roughly 2,100 to 3,100 hours, and about two-thirds of those are mine, mostly evenings and weekends. Building the same thing by hand would take a team of six to eight people several years, somewhere around 20 to 35 person-years.

**— Vincent**
