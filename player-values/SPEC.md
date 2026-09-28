# Dynasty Ticker: independent player valuation specification

Prepared September 28, 2026.

## What is running

`player-values/build.py` is the shipped model (`football-forecast-v1`). It writes `docs/data/player_values.json`. The running math is in `player-values/README.md`:

- eight seasons of expected full-PPR points per game above a 12-team reference replacement
- annual discount 0.85, owned by `config.json`
- display scale 20, the same ruler in both formats
- one shared RB/WR/TE price; Superflex changes the QB alternative only

Sections 4–10 are the target design (routes, weekly lineup simulation, joint scenarios). The builder does not run that design. A number in the snapshot comes from the shipped formula, not from an unestimated feature coefficient in those sections.

Shipped rules:

- Each reference team keeps at most 2 quarterbacks in 1QB and 3 in Superflex. The alternative is the best player left outside that roster. If the historical pool is smaller than the cap, the alternative is the last rostered player. Replacement is never zero.
- A player with no game since the previous season is left out. `active: false` and retired or inactive statuses are left out.
- Sleeper joins nflverse on `gsis_id`, then ESPN id, then a unique name at the same position, then a unique name. A second player with the same name at another position does not block the match. A defensive chart with real targets or carries, such as a two-way receiver, counts as an offensive player.
- Future-pick prices use historical rookie outcomes, then a decreasing smooth so an earlier pick is worth at least as much as a later pick. A missing catalog year in the app slides by the same 0.85 discount.
- The holdout freezes transition tables and replacement levels at `validationTrainingThrough` (2020). It measures one-year above-replacement error only.

The owner-defined scope is two dynasty markets: 1QB full PPR and Superflex full PPR. No TE, RB, or other positional scoring bonuses. No imported KTC values or other dynasty price targets. Skill-position football projections are shared between formats. QB and pick valuation must account for format.

## 1. What the number means

Start with an independent football value:

**The expected future lineup advantage from holding a player, relative to an available alternative, discounted over time.**

That is an estimate of fantasy usefulness. To estimate the price managers will actually accept, optionally calibrate this independent estimate with Dynasty Ticker's own qualifying trades and votes. Football production and exchange prices are related, but not identical targets.

The fundamental player model has four stages:

1. Forecast team opportunities and player role.
2. Forecast efficiency conditional on role and availability.
3. Forecast how role, performance, and availability evolve over the player's career.
4. Convert the resulting fantasy-point distributions into value above a reference alternative.

Do not add a separate youth bonus, talent bonus, team multiplier, or injury penalty after those effects have already entered the forecast.

## 2. Fixed product assumptions

| Setting | Proposed definition | Status |
|---|---|---|
| Market formats | 1QB/PPR and Superflex/PPR | Owner requirement |
| Reception points | 1 per reception for all eligible positions | Owner requirement |
| Passing yards | 0.04 points per yard | Proposed fixed rule |
| Passing TD | 4 points | Proposed fixed rule |
| Interception thrown | -2 points | Proposed fixed rule |
| Rushing/receiving yards | 0.10 points per yard | Proposed fixed rule |
| Rushing/receiving TD | 6 points | Proposed fixed rule |
| Lost fumble | -2 points | Proposed fixed rule |
| Two-point conversion | 2 points to credited offensive player | Proposed fixed rule |
| Yardage, long-play, first-down, return-yard bonuses | None | Proposed fixed rule |
| Reference league size | 12 teams | Proposed internal assumption |
| Reference lineup | 1 QB, 2 RB, 3 WR, 1 TE, 2 FLEX; SF version adds 1 Superflex slot | Proposed internal assumption |
| Reference bench | 12 bench slots; replacement estimates also model roster allocation | Proposed internal assumption |
| Fantasy schedule | Weeks 1–17; actual games and byes respected | Proposed internal assumption |
| Forecast horizon | 8 seasons, including remaining current season | Provisional setting |
| Annual time factor | 0.85 per year of delay | Provisional preference/calibration setting |
| Display conversion | 20 displayed points per discounted point of lineup advantage | Arbitrary fixed scale |
| Star multiplier | None | Design choice |
| Personal-league price multiplier | None | Design choice |

The reference league exists to define scarcity. It does not add user-facing controls. Test the model against reasonable changes in roster depth before treating the reference league as representative.

At launch, use a common RB/WR/TE replacement framework in both formats and a different QB replacement framework. Superflex's extra slot can create indirect skill-position effects; allow those only after a consistent lineup simulation or sufficient format-specific market evidence supports them.

Do not independently normalize each format's top player to 10,000. That would change the ruler between formats and undermine the shared baseline.

## 3. The greater equation

For player i, format f, and forecast season h:

- A(i,h,f) = expected usable lineup-point advantage in that season.
- d = annual time factor, initially 0.85.
- tau(h) = years until those points are earned.
- H = 8 modeled seasons.

Then:

**FundamentalUtility(i,f) = sum over h of d^tau(h) × A(i,h,f)**

**DisplayedFundamentalValue(i,f) = round(20 × max(0, FundamentalUtility(i,f)))**

A simplified seasonal decomposition is:

**A(i,h,f) = sum over role states s of q(i,h,s) × G(i,h,s) × max(mu(i,h,s) - R(position,f,h), 0)**

Where:

- q = probability of that role state, including an out-of-league state.
- G = expected eligible, healthy, usable games conditional on that state.
- mu = expected PPR points per game conditional on the state and availability.
- R = the projected points of a feasible replacement alternative.
- Out-of-league states contribute zero.
- The full implementation performs the calculation by week and respects lineup eligibility.

The seasonal product is an explanatory approximation. Role, games, performance, and replacement quality are correlated; production evaluation should average joint scenarios instead of multiplying unrelated averages.

Lineup decisions must use information available before lineup lock. Never credit a player with the benefit of selecting only the weeks in which he subsequently happened to score well.

At 0.85 annual discounting, a comparable contribution in forecast years 1–8 has weights:

| Forecast year | Relative weight |
|---|---:|
| 1 | 1.0000 |
| 2 | 0.8500 |
| 3 | 0.7225 |
| 4 | 0.6141 |
| 5 | 0.5220 |
| 6 | 0.4437 |
| 7 | 0.3771 |
| 8 | 0.3206 |

These are not percentages that must sum to 100. Future production is additional value. Career survival and performance projections determine how much contribution exists in each year.

The initial eight-season horizon assigns zero beyond year eight. Measure sensitivity to extending it, particularly for young QBs. Do not add a resale value that capitalizes the same years already included; a terminal value, if introduced, may cover only years outside the explicit horizon.

## 4. Exact point-production equations

For a receiving player, use one coherent opportunity decomposition:

**Targets = team dropbacks × route participation × targets per route**

**Receptions = targets × catch probability**

**Receiving yards = receptions × expected yards per reception**

**Receiving TD = sum over target-location/role buckets of targets in bucket × TD probability in bucket**

If reliable routes are unavailable:

**Targets = team target opportunities × target share**

Keep denominator definitions explicit. Team target opportunities exclude plays that cannot generate an official target under the source's definitions.

For rushing:

**Designed carries = team designed rushing attempts × player carry share**

**Rushing yards = carries × expected yards per carry**

**Rushing TD = sum over field-position buckets of carries in bucket × TD probability in bucket**

For QBs:

**Scrambles = dropbacks × scramble probability**

**Passing yards = attempts × completion probability × yards per completion**

**Passing TD = attempts × conditional passing-TD rate**

**Interceptions = attempts × conditional interception rate**

Account for sacks, scrambles, throwaways, and kneels consistently when turning team dropbacks into attempts, targets, and rushing attempts.

Finally, apply the fixed scoring coefficients in section 2 to projected official statistics.

Do not also award points for yards per route, EPA, target share, or prior fantasy points. They are predictors of the projected statistics; adding them to the result would count evidence twice.

Team-level allocations must reconcile: teammates cannot jointly claim more carries or targets than the modeled team supplies.

## 5. Feature inventory: every position

C = core candidate available from ordinary historical data with a verified feed.
E = enhanced candidate that requires verified historical AND current coverage.
M = metadata or quality control, not a positive/negative player score.
A candidate is retained only when it improves chronological validation or is needed for a structural calculation.

| Group | Actual fields/features | Use | Priority |
|---|---|---|---|
| Identity | Stable player ID; source ID mappings; season; week; timestamp | Prevent mismatches and future-information leakage | M |
| Position | QB/RB/WR/TE; eligible lineup slots; position-change history | Select projection model and reference alternative | C |
| Age | Age at game/season date in decimal years; future age at each horizon | Nonlinear development, decline, role retention, exit probability | C |
| Experience | NFL seasons elapsed; seasons with a meaningful role; career games and starts | Separate a late developer from an equally aged veteran | C |
| Physical profile | Height; weight; position-specific body profile | Weak prior, especially with little NFL evidence | C |
| Draft investment | NFL overall selection; draft round; undrafted indicator; age at draft | Initial role/talent prior and job-security predictor | C |
| Career opportunity | Career dropbacks/routes/targets/carries; accumulated exposure | Estimate evidence strength and career trajectory | C/E |
| Recent opportunity | Offensive snaps and share; starts; relevant opportunity rates | Predict current role | C |
| Role trend | Changes over recent games, season, and prior seasons; confirmed role-change indicator | Detect promotions, demotions, and temporary usage | C |
| Production history | Official game-level passing/rushing/receiving stats; derived PPR production | Train outcomes and summarize evidence | C |
| Efficiency history | Position-specific rates; exposure counts; opponent and situation context | Estimate repeatable output per opportunity | C/E |
| Current health | Reported injury; report/practice status; injured-reserve/PUP status; report timestamp | Probability of playing and limited participation | C |
| Availability history | Games missed with known cause; injury timing; recurrence information; exposure | Forecast availability conditional on age and role | C/E |
| Return trajectory | Time since return; snap/opportunity changes following return | Forecast current limitation without a second arbitrary penalty | C |
| Employment status | Active roster; practice squad; free agent; confirmed retirement; suspension and eligibility dates | Possible role states and eligible games | C |
| Contract | Years remaining; guaranteed commitment; cap-adjusted compensation; known exit/option dates | Job/role continuity and probability of changing teams | C/E |
| Competition | Teammates at the position; their usage, age, draft investment, contracts, availability | Allocate future touches/targets and model role competition | C |
| Transactions | Confirmed signings, trades, releases, drafted competition | Structural updates to role assumptions | C |
| Team opportunity | Offensive plays; dropbacks; designed rushes; situation-adjusted pass tendency; pace | Size of the available opportunity pool | C |
| Scoring environment | Drives; red-zone entries; goal-line plays; offensive efficiency | TD opportunities and game context | C |
| Supporting QB | Passing efficiency; accuracy; starting probability; rushing tendencies; expected changes | Receiving opportunity/efficiency context | C/E |
| Offensive line | Personnel continuity; pressure/blocking proxies; injuries; verified blocking metrics | Conditional passing/rushing efficiency | C/E |
| Coaching | Coordinator/head-coach changes; observed personnel and play-calling tendencies | Forecast changes in volume and role | C/E |
| Scheme/role fit | Slot/outside/inline/backfield usage; personnel packages | Contextual predictor where reliable | E |
| Schedule | Remaining opponents, games, byes; current-season context | Near-term production; not a permanent dynasty multiplier | C |
| Data reliability | Missingness; source latency; sample sizes; revisions; definition changes | Shrinkage and uncertainty | M |

Team identity is primarily a join key. There is no permanent Dallas/Detroit/Kansas City bonus. Model the team's current football conditions and uncertain future conditions.

A missed game caused by a bye, suspension, healthy scratch, or injury is not the same event. Store causes separately. Missing injury data does not mean healthy.

## 6. Position-specific football features

### Quarterbacks

| Feature family | Concrete candidate fields | Main forecast affected |
|---|---|---|
| Starting role | Start probability; recent starts; share of team QB snaps/dropbacks; competitor quality; contract commitment; draft capital | Usable games and future starter probability |
| Passing volume | Team dropbacks; attempts per start; situation-adjusted pass tendency; pace | Attempts |
| Accuracy | Completion rate; completion percentage over expectation where available; depth-specific completion rates | Completions and efficiency |
| Passing efficiency | Yards/attempt; air yards/attempt; passing EPA/dropback with shrinkage; sack rate; pressure-to-sack behavior where available | Yards and future role retention |
| Scoring/turnovers | Red-zone attempts; passing TD rate; interception rate; lost-fumble rate | TDs and turnovers |
| Rushing | Designed rushes; scrambles/dropback; rushing yards/attempt; inside-10 and inside-5 carries; rushing TD opportunity | Rushing points |
| Support | Receiver/TE availability and quality; line context; coach continuity | Conditional rates and opportunity |
| Longevity | Age; experience; rushing dependence; role history; contract and competition | Future career states |

Passing ability and rushing fantasy production must be represented separately. A productive rushing QB's fantasy rate and his probability of keeping an NFL starting job can move differently.

### Running backs

| Feature family | Concrete candidate fields | Main forecast affected |
|---|---|---|
| Workload | Carries/game; carry share; offensive snap share; starts | Carries and role |
| Valuable rushing usage | Carries inside the 20/10/5; short-yardage share; designed goal-line use | TD opportunities |
| Receiving | Targets/game; target share; routes/dropback and targets/route where available; catches; target depth | Receiving points |
| Passing-down role | Two-minute/third-down participation; route/blocking split; verified pass-protection information | Probability of receiving opportunity |
| Rushing efficiency | Yards/carry; rushing success; rush yards over expected where available | Yards per opportunity |
| Enhanced ability | Yards after contact; forced missed tackles; explosive-run rate, all exposure-adjusted | Candidate efficiency predictors |
| Ball security | Fumbles and losses per relevant opportunity | Turnovers and possibly role |
| Backfield competition | Other RB usage; injured starter returning; rookie investment; committee structure | Workload distribution |
| Career state | Age; experience; cumulative workload; injury history; commitment | Availability and role survival |

Do not infer a fixed decline cliff from birthday alone. Estimate nonlinear age/experience/role interactions. Cumulative touches are a candidate predictor, not an automatic wear penalty.

### Wide receivers

| Feature family | Concrete candidate fields | Main forecast affected |
|---|---|---|
| Route access | Route participation; snaps; slot/outside alignment where available | Opportunities to earn targets |
| Target earning | Targets/game; target share; targets/route; first-read share if verified | Targets |
| Target profile | Average depth of target; air-yard share; short/deep and end-zone target mix | Catch rate, yards, TD opportunities |
| Efficiency | Catch rate relative to target difficulty; yards/reception; yards/target; yards/route where available | Future efficiency and target earning |
| After catch | YAC/reception; YAC above expectation when covered | Receiving yards |
| Scoring role | Red-zone/end-zone targets; historical TD rate with shrinkage | TDs |
| Enhanced receiver detail | Separation; contested-target results; drops; coverage/route-type splits | Optional predictors, not standalone bonuses |
| Context | QB quality/availability; competing receivers and TEs; pass volume | Volume and efficiency |
| Career state | Age; experience; early-career production; role progression | Future target earning and longevity |

### Tight ends

Use the receiver families, plus:

| Additional field | Why it matters |
|---|---|
| Route participation versus blocking snaps | Offensive snap share alone can overstate receiving opportunity |
| Inline/slot/wide alignment | Describes the receiving role |
| Targets per route | Measures target earning when released into a route |
| Red-zone/end-zone share | Describes scoring opportunity |
| Position-room competition and personnel usage | Affects whether routes are available |
| Experience and career role development | Allows a TE-specific career trajectory |

TEs receive the same one point per reception. Positional scarcity is handled by the reference alternative, not a scoring premium.

## 7. Rookies and players with little NFL evidence

Rookies need a prior based on comparable football histories, not zero production and not a flat 1,200-point price.

| Input | Definition/treatment |
|---|---|
| NFL draft capital | Overall selection and undrafted status; modeled nonlinearly |
| Age | Age at draft; age relative to college competition |
| College production | Position-relevant yards, TDs, carries, targets, receptions, efficiency where covered |
| College market share | Share of team receiving/rushing production; use denominator and team context consistently |
| Production by age | Whether output occurred unusually early or late relative to comparable players |
| Experience/path | Seasons played, transfers, changes in competition; account for era |
| Competition | Conference/opponent context when historical coverage supports adjustment |
| Athletic measurements | Position-specific size, speed, explosion, agility; missing tests remain missing |
| Role | Passing/rushing QB; receiving/workload RB; target-earning receiver; receiving/blocking TE |
| Health | Known availability limitations and uncertainty |
| Landing spot | Opportunity competition, coaching, supporting offense |
| NFL evidence as it arrives | Snaps, routes, targets, carries, passing attempts, efficiency |

Before the NFL draft, use a distribution of possible draft outcomes if a credible football-only projection is available; do not silently treat an unknown draft pick as a late-round selection.

After the draft, do not give college production, combine measurements, and draft capital full independent bonuses. NFL draft capital already summarizes some of the same information. Learn the incremental usefulness of each.

As NFL evidence accumulates, reduce reliance on the prospect prior using sample-size-aware updating. There is no universal rule that draft capital becomes irrelevant after exactly one or two seasons.

## 8. Weights: what is fixed and what must be estimated

There is no empirically justified universal equation such as 20% age + 20% team + 30% stats + 30% talent. Those quantities overlap, use different units, and interact by position.

Instead, assign inputs to specific conditional forecasts. Train separate models for team volume, role, efficiency, availability, and career transitions. A coefficient that predicts next week's target share is not the same coefficient that predicts five-year career survival.

| Quantity | Proposed initial value | Meaning |
|---|---:|---|
| PPR reception contribution | 1.0 | Fixed scoring rule |
| Passing/rushing/receiving scoring | Section 2 | Fixed scoring rules |
| Annual discount | 0.85 | Provisional preference parameter; test and calibrate |
| Explicit career horizon | 8 seasons | Provisional computational choice; test tail sensitivity |
| Opportunity recency half-life | 4 played games | Prototype smoothing for current role; reset/condition on confirmed role changes |
| Efficiency recency half-life | 32 played games | Prototype smoothing that keeps a longer ability history |
| Team-context recency half-life | 8 team games | Prototype smoothing; coaching/QB changes require conditioning |
| External dynasty-price contribution | 0 | No KTC or imported dynasty prices |
| Independent age bonus | 0 | Age already changes future performance and survival |
| Independent team bonus | 0 | Context already changes opportunities and rates |
| Independent injury penalty | 0 | Health already changes games, role, and conditional performance |
| Independent star multiplier | 0 | Advantage over alternatives already gives stars more utility |
| Independent confidence penalty | 0 | Uncertainty is modeled; missing information is not automatically bad talent |
| Display scale | 20 | Fixed arbitrary linear conversion |
| Individual feature coefficients | Learned by position/submodel | No fabricated exact percentages |

All three smoothing half-lives above are candidate launch defaults, not measured reliability thresholds. Cross-validation may replace them entirely with a learned temporal model.

A transparent shrinkage formula for rate estimates is:

**estimate = [n/(n+k)] × observed rate + [k/(n+k)] × prior rate**

- n is the recency-weighted relevant exposure, not just games played.
- k is a fitted prior-equivalent exposure for that statistic and position.
- Prior rates come from the player's history and comparable players.
- k must differ for a relatively frequent event such as a catch versus a rare event such as a touchdown.
- For illustration only, if k=100 and n=25, current evidence gets 20% weight; if n=100, it gets 50%; if n=400, it gets 80%.
- These examples explain the equation; they do not prescribe a universal k=100.

Fit coefficients and k values with chronological validation. Report per-player explanations as model-estimated effects or scenario differences. Feature-importance percentages are not universal causal weights.

If an immediate hand-weighted prototype is required, treat it as an explicitly unvalidated benchmark, not as a production valuation system. Do not represent invented feature percentages as learned evidence.

## 9. Estimating the learned parts

Start with simple regularized models that can be inspected:

- Counts/opportunities: rate or count models with exposure offsets.
- Shares/probabilities: bounded or logistic models.
- Efficiency: regularized regression with sample-size-aware pooling.
- Availability: per-week play and limitation probabilities.
- Career path: position-specific transitions among role states and NFL exit.

Compare more flexible tabular models only if they improve held-out forecasts and calibration. The model class is a validation choice, not a requirement to use a particular library.

Learn from historical inputs and subsequent football outcomes:

| Submodel | Training target |
|---|---|
| Team volume | Future plays, dropbacks, rush attempts, scoring opportunities |
| Player role | Future route/target/carry share; starting status |
| Efficiency | Future yards, completions/catches, TDs and turnovers conditional on opportunity |
| Availability | Future game participation and limitation |
| Career transitions | Future role, employment, productive participation, exit |
| Distribution/uncertainty | Frequency of outcomes within forecast intervals |
| Optional market calibration | Held-out qualifying trades and votes |

Include players who lost their roles or left the league. Computing age curves only from survivors makes careers look too durable. Players whose later careers have not yet been observed are censored; their unseen future is not automatically zero.

## 10. Uncertainty, upside, and backups

Represent distributions across role and performance scenarios.

Example: a young receiver may have a meaningful chance of becoming a high-volume starter and a substantial chance of remaining a reserve. Forecast both outcomes. Do not replace that distribution with a generic youth bonus.

A backup RB can have value through future starting opportunities, contingent current-season opportunity, and future contracts. The probability of those opportunities and the projected advantage while they occur create the value.

Evaluate the positive advantage of observable, forecastable role scenarios. Do not take the maximum of realized weekly box scores after the fact. That would reward volatility with impossible lineup foresight.

Keep uncertainty intervals separate from value. A player with uncertain but valuable upside should not automatically be discounted merely because the data is thin. Risk preferences belong in team-specific advice or a separately validated utility objective.

## 11. 1QB, Superflex, and positional scarcity

Use the same football forecast for a player in either fantasy format. Josh Allen's projected NFL touchdowns do not change because the fantasy league changes.

The format changes the value of the alternative available at QB. Estimate that alternative from a reference roster/startup allocation and plausible substitutes. Do not equate the QB alternative mechanically to QB13 in 1QB or QB25 in SF; bench depth, byes, roster availability, and flex eligibility matter.

Shipped v1 uses that roster idea with an explicit cap in `config.json`: 2 quarterbacks per team in 1QB and 3 in Superflex. The bench stops taking quarterbacks at the cap, so the alternative stays a real player. An empty waiver pool uses the last rostered player instead of zero.

For RB/WR/TE, start with a shared valuation baseline. Permit small format departures only from consistent lineup-demand modeling or strong market evidence. Do not manufacture separate non-QB prices from small samples.

TE scarcity remains part of roster utility even with no TE premium scoring. A top TE can create lineup advantage while receiving exactly the same PPR points per catch as a WR.

## 12. Draft picks from scratch

Value a fantasy rookie pick as a probability-weighted choice among the players likely to be available at that slot:

1. Forecast the available rookie pool and its football outcomes.
2. Estimate which prospects are likely to be selected before each slot.
3. Value the choice available at that slot, with uncertainty and realistic information timing.
4. Separate 1QB and Superflex because QB demand changes who is taken where.
5. For an unknown future slot, average across a slot distribution instead of pretending every first is mid-round.
6. Discount the delay until the player contributes.
7. Use historical class distributions when future class information is thin.

Do not add a second 12% annual pick discount if the same delay is already accounted for in the discounted contribution model. Do not assume future classes are equally strong once credible evidence exists.

Shipped v1 orders historical rookies by NFL draft pick, a format quarterback shift in `config.json`, and age. 1QB moves quarterbacks back a round. Superflex moves them back 8 picks, so they stay earlier than in 1QB. Published bucket prices are then capped so a later pick cannot outrank an earlier one. The app's fallback for a year missing from the snapshot uses the same 0.85 annual discount as `config.json`.

## 13. Optional market price from our own evidence

The football model can run without any external dynasty prices, Sleeper trades, or votes. Those observations answer a different question: what managers actually exchange or prefer.

If calibrating market prices:

- The football estimate supplies an anchor and uncertainty.
- Full-PPR/no-premium completed trades supply noisy package relationships.
- Format-tagged votes supply ordinal preference evidence.
- Use robust errors for trades, account for overlapping leagues/managers, and deduplicate events.
- Use the same package evaluator in fitting and in the calculator.
- Estimate how strongly each source should influence a player from out-of-sample performance and evidence quality.
- Keep one canonical published market value per player per format.

Do not call an uncalibrated football score a proven market-clearing price. Do not translate a 70% vote preference directly into a 70% value premium.

An optional joint calibration can penalize distance from the uncertain football anchor, robust package-price discrepancies in trades, and incorrect pairwise vote predictions. The loss scales must be calibrated; 50/30/20 is not a scientific default.

## 14. Data sources and actual availability

The nflverse ecosystem is a practical foundation for play-by-play, official player/team stats, rosters, schedules, IDs, snap counts, draft history, combine measurements, selected advanced metrics, and contract data.

Verify every feed's timestamp, coverage, definitions, and current-season availability before making it a required input.

| Source | Proposed use | Verified documentation |
|---|---|---|
| nflfastR/nflreadr | Play-by-play, player/team stats, schedules, roster context | https://nflreadr.nflverse.com/articles/nflverse_data_schedule.html |
| nflverse/PFR snap counts | Game-level offensive snaps and share | https://nflreadr.nflverse.com/reference/load_snap_counts.html |
| nflverse historical draft data | NFL draft capital | https://nflreadr.nflverse.com/reference/load_draft_picks.html |
| nflverse combine data | Measurables and athletic priors | https://nflreadr.nflverse.com/reference/load_combine.html |
| nflverse/OverTheCap | Contract history and team commitment | https://nflreadr.nflverse.com/reference/load_contracts.html |
| nflverse Next Gen Stats | Selected passing, rushing, receiving advanced data | https://nflreadr.nflverse.com/reference/load_nextgen_stats.html |
| Current verified injury/status feed | Availability and report timestamps | https://nflreadr.nflverse.com/reference/load_injuries.html |
| Dedicated route/charting provider if obtained | Routes, first-read share, route/block split, advanced role | Coverage must be separately verified |
| College data provider | Rookie inputs with consistent historical definitions | Provider selection remains open |
| Sleeper | Identity/roster integration and optional format-filtered trades | https://docs.sleeper.com/ |

Important availability constraint: nflverse documents participation data from 2023 onward as released after the postseason, not updated during the season. Its historical availability does not establish a live route-stat feed. See https://nflreadr.nflverse.com/reference/load_participation.html.

Use an explicit fallback model based on snaps, team attempts, targets, and target share when routes are unavailable. Do not substitute zero for missing routes or silently present targets per snap as targets per route.

## 15. Storage and reproducibility

Store immutable or versioned observations with:

- player/source identifiers;
- event date and the time the information became available;
- provider and source version;
- position and team at the time;
- statistic definition and denominator;
- game/season context;
- missingness and freshness flags;
- model version and as-of timestamp.

Persist each value snapshot with:

- player ID and format;
- fundamental utility and displayed value;
- optional calibrated market value;
- forecast distributions by season;
- replacement assumptions;
- evidence/confidence explanation;
- most consequential changed inputs;
- input snapshot and model IDs.

Train on as-of joins. A contract signed in March cannot appear in a prediction dated the previous December. A current depth chart cannot overwrite the player's historical role.

## 16. Validation and release gates

Compare against simple football-only baselines, such as age-adjusted prior production and opportunity-based projections.

Use rolling historical cutoffs: train only on earlier information, predict subsequent periods, and keep validation players/seasons appropriately grouped. For any market calibration, withhold later trades and entire league/voter clusters.

The shipped holdout freezes both the transition tables and the replacement levels at `validationTrainingThrough`. Scoring a later season with a replacement fit on that same season is not this test. The published claim is one-year above-replacement error against a persistence baseline. It does not claim eight-year calibration or that the rookie board matches real dynasty drafts. The snapshot still has to keep early firsts ahead of mid firsts and mid firsts ahead of late firsts.

Evaluate:

- Next-period opportunity and efficiency errors by position.
- Availability and starting-role probability calibration.
- Career retention and exit calibration.
- Future usable lineup advantage and ranking quality.
- Rookie and low-sample performance separately.
- Interval coverage and behavior when data is missing.
- Sensitivity to discount rate, horizon, roster depth, and replacement method.
- Optional held-out trade and vote behavior.
- Stability without suppressing legitimate injury, trade, and role-change updates.

A small unit-test suite cannot establish prediction accuracy. Mathematical invariants still matter:

- Identical football inputs produce identical football projections across formats.
- The same canonical value reaches every relevant screen.
- All probability distributions are valid and teammate usage sums reconcile.
- A missed current season does not erase plausible future contribution.
- Retirement makes future contribution zero unless there is explicitly modeled return uncertainty.
- Missing data does not create a guaranteed starter or zero-talent player.
- The display conversion remains fixed across formats and dates.
- A value movement can be traced to an input update or model revision.

## 17. Worked illustration

Hypothetical players with the same first-year advantage, not real player projections:

| Forecast year | Player A expected usable advantage | Player B expected usable advantage |
|---|---:|---:|
| 1 | 80 | 80 |
| 2 | 75 | 50 |
| 3 | 60 | 15 |
| 4 | 40 | 0 |
| 5 | 20 | 0 |
| 6 | 10 | 0 |
| 7 | 0 | 0 |
| 8 | 0 | 0 |

With 0.85 annual discounting:

- A: utility approximately 226.54; displayed value approximately 4,531.
- B: utility approximately 133.34; displayed value approximately 2,667.

A's greater value comes from the modeled future contribution. There is no separate age bonus. Age, role security, health, skill, and context all helped generate the future path.

For a single-season illustration, 14 expected usable games at 18 projected PPR points per game against an 11-point alternative produce approximately 98 points of advantage. If projected production rises by one point per game, advantage rises by 14. Those are interpretable units; a one-point increase in a generic 0–100 talent score is not.

## 18. Recommended implementation order

1. Fix scoring, the reference league, identifiers, event timestamps, and source contracts.
2. Build game-level histories and an availability-aware dataset.
3. Produce current-season opportunity and efficiency forecasts with explicit missing-data paths.
4. Train age/experience/role/exit models, including players who leave the NFL.
5. Aggregate future lineup advantage and publish a stable linear scale.
6. Add the rookie model and draft-pick distributions.
7. Run historical validation and shadow current production.
8. Add market calibration only when its evidence and held-out performance justify it.

The complete inventory is a candidate set, not an instruction to retain every correlated metric. A smaller model that predicts well and handles missing evidence honestly is preferable to an unvalidated score containing every available column.
