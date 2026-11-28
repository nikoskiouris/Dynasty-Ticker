# What managers received for Williams, Gibbs and Nabers

On November 28, 2026, a search of FantasyCalc's completed-trade database found Jameson Williams alone for a 2027 second and a 2028 second in 23 distinct leagues. Four October and November 2026 deals had one QB slot, one superflex slot, 12 teams, full PPR, zero TE premium and four points per passing touchdown. The same exchange cleared with eight, ten and eleven starters. A separate public Sleeper league paid a 2027 first for Williams on November 24. Those observations support treating the two seconds as a credible offer and show why a manager could ask for more. [Exact three-asset query](https://api.fantasycalc.com/trades?isDynasty=true&numQbs=2&numTeams=12&ppr=1&minPlayers=3&maxPlayers=3&side1=1100&side2=9693&side2=9723) · [Sleeper transaction log](https://api.sleeper.app/v1/league/1312703687855988736/transactions/11)

## The same offers on the November 28 board

| Offer | Using whole-round prices | If the 2027 pick is early | If the 2027 pick is late |
| --- | --- | --- | --- |
| Williams for a 2027 second and a 2028 second | Williams leads by 9% (Close) | Picks lead by 6% (Close) | Williams leads by 14% (Close) |
| Gibbs for Nabers and a 2027 first | Gibbs leads by 19% | Even, within 5% | Gibbs leads by 23% |

These are the calculator's adjusted package totals compared with the lower side. Williams lists at 29.50 against 28.70 for the two picks. A 1.68 consolidation credit gives his side 31.18. The underlying trade quotes favor the picks by 9.9%. The football forecast gives Williams 77.9 remaining PPR, about 17.7 points above his reference replacement. How many of those points a particular manager can use depends on who would start in his place. The board only has a whole-round 2028 second, so its price stays fixed in both scenarios. [Dated price board](../../docs/data/price-history/202611280526.json)

Gibbs lists at 99.05 against 58.37 for Nabers. The 2027 first adds 27.51 at its whole-round price or 48.00 at its early price. Those are distinct published quotes. Adding an additional whole-round 2028 first is a different offer and puts the package within 5% of the Gibbs side. [Board and source coverage](../../docs/data/player_values.json) · [Training and validation](pick-packages.md)

## What KeepTradeCut collects

KTC says its Dynasty Trade Database holds millions of completed trades across several dynasty platforms. The database displayed 241,411 leagues when inspected. Its Tradesourced values estimate individual prices from those package exchanges using a proprietary algorithm. Its Crowdsourced values aggregate users’ daily three-player Keep/Trade/Cut choices with an adapted Elo algorithm. Crowd+Trades blends the two estimates. Each database transaction provides one observation, even when it is also reflected in a published provider quote. [Trade database](https://keeptradecut.com/dynasty/trade-database) · [KTC methodology](https://keeptradecut.com/about/player-values)

KTC supports public league-ID sync for Sleeper, MyFantasyLeague, FFPC, Fleaflicker and Fantrax and documents refreshing league rosters through platform APIs. The cited documentation gives no sampling rate by platform, exact trade-ingestion schedule, or guarantee that every synced league feeds the trade database. KTC's FAQ says it estimates a generic future pick price per round from trades and borrows early/mid/late splits from its crowdsourced prices. A transaction naming only a future round leaves the intended draft slot uncertain. [League sync](https://keeptradecut.com/dynasty/power-rankings) · [KTC FAQ](https://keeptradecut.com/frequently-asked-questions)

### How this model used the linked database

On November 28 we opened KTC’s Gibbs search (player 1415). Its initial page contained 200 recent trade rows dated November 27–28 from across the database, before the browser applies its player filter. We took every unique Sleeper league ID whose public league URL matched the ID in the row. That yielded 169 seed leagues. We selected leagues before evaluating player names, returns or model errors. The page's bulk trade request was unavailable from the research environment (HTTP 403). The frozen list records exactly what was accessible on that date. [Linked page](https://keeptradecut.com/dynasty/trade-database?search=1415) · [169 seed IDs](ktc-sleeper-leagues-20261128.txt)

We then queried Sleeper directly for each league’s settings and all transaction periods 0–12. Fourteen matched the reference scoring and roster filters and contributed 220 completed two-manager trades in the August 18–November 27 study window. This approach verifies both sides of each offer, including the draft year and round. It selects active leagues visible on KTC in late November and will underrepresent quieter leagues. It also avoids a dependency on KTC availability during the daily board refresh. [Collector](market_packages.py) · [Parameter fit](fit_exchange.py)

## Public Sleeper transaction check

We checked both existing public league lists, covering 157 candidate league IDs. The repository's `league_eligible` function selected 145 league seasons. For transaction periods 0 through 12 we retained completed two-team trades with reciprocal player/pick ownership and no FAAB, using the `exchange` function. We deduplicated by Sleeper transaction ID and included completion dates through November 27 UTC, including preseason. That produced 2,630 trades from 141 leagues. Gibbs appeared in 12, Nabers in 26 and Williams in 45. These are transactions marked complete at retrieval. Subsequent reversals and off-platform consideration were not independently audited. [Discovery league IDs](market-leagues-2026.txt) · [Additional league IDs](market-leagues-independent-2026.txt) · [Format and transaction filters](market_packages.py)

The table shows full exchanges. The source for each row is the original league’s public transaction-period response. Search that response for the transaction ID. The panel had zero Gibbs-versus-Nabers trades and zero trades of Williams alone for exactly two seconds. Player or pick add-ons change the exchange.

| Completed (UTC) | One manager received | Other manager received | Sleeper transaction |
| --- | --- | --- | --- |
| Nov 24, 2026 | Jameson Williams | 2027 first | [1430790015884992512](https://api.sleeper.app/v1/league/1312703687855988736/transactions/11) |
| Nov 23, 2026 | Jahmyr Gibbs | Tee Higgins + 2027 first + 2027 second | [1430459731377401856](https://api.sleeper.app/v1/league/1312131553995804672/transactions/11) |
| Nov 10, 2026 | Malik Nabers | Garrett Wilson + 2027 first | [1425920351656738816](https://api.sleeper.app/v1/league/1347025909739184129/transactions/9) |
| Oct 8, 2026 | Malik Nabers | Makai Lemon + 2028 first + 2028 second | [1413786429921775616](https://api.sleeper.app/v1/league/1312150470713688064/transactions/5) |
| Oct 4, 2026 | Jameson Williams | Rashee Rice | [1411846767296688128](https://api.sleeper.app/v1/league/1312091618483916800/transactions/4) |
| Aug 13, 2026 | Jameson Williams | 2028 first | [1392761040231493632](https://api.sleeper.app/v1/league/1313782177804087296/transactions/1) |

## Exact exchanges in the wider FantasyCalc database

Both searches requested dynasty, 12 teams, two QB equivalents, 1 PPR and exactly three total assets. We checked both sides, player IDs and the returned league settings. FantasyCalc leaves `siteLeagueId` blank on these rows, so the underlying hosting platform could not be verified from its public results. The counts describe the records returned on November 28. Targeted, anonymized results may overlap other sources and do not establish how often the same offer would be accepted. [Williams results](https://api.fantasycalc.com/trades?isDynasty=true&numQbs=2&numTeams=12&ppr=1&minPlayers=3&maxPlayers=3&side1=1100&side2=9693&side2=9723) · [Gibbs and Nabers results](https://api.fantasycalc.com/trades?isDynasty=true&numQbs=2&numTeams=12&ppr=1&minPlayers=3&maxPlayers=3&side1=9821&side2=11737)

Of the 23 exact Williams trades, seven had zero TE premium, and five of those had four-point passing touchdowns. Four of the five occurred in 2026, with the fifth on October 31, 2025. Every trade in the table was Williams alone for one second in each draft year.

| Date (UTC) | Starters | Roster size | FantasyCalc trade ID |
| --- | ---: | ---: | --- |
| Nov 12, 2026 | 10 | 28 | `8dc707f2-9a51-3caa-9960-b4c95c3b4703` |
| Nov 11, 2026 | 10 | 22 | `1c0617f7-a841-34d0-8ecb-b7d9a956e330` |
| Oct 23, 2026 | 11 | 23 | `ead56ac3-998d-3e61-ab79-a2fd8ffa3f29` |
| Oct 2, 2026 | 8 | 24 | `c85492c5-5d90-317e-b21f-0ba700f95df4` |

The Gibbs/Nabers query returned 36 three-asset trades spanning February 2025 through August 2026. In 2026, three deals had Gibbs alone for Nabers plus a first. One used a generic 2027 first, and two used exact 2026 draft slots. There were no results where Nabers alone bought Gibbs plus a first. Direction, pick precision, elapsed time, and differences in scoring limit a comparison to a November offer. [Gibbs and Nabers results](https://api.fantasycalc.com/trades?isDynasty=true&numQbs=2&numTeams=12&ppr=1&minPlayers=3&maxPlayers=3&side1=9821&side2=11737)

| Date (UTC) | One manager received | Other manager received | Starters | TE premium | Pass TD | FantasyCalc trade ID |
| --- | --- | --- | ---: | ---: | ---: | --- |
| Aug 27, 2026 | Gibbs | Nabers + 2027 first | 11 | 0.5 | 6 | `144a8ba4-19b8-3d87-a27a-88eb02e09d2c` |
| Mar 16, 2026 | Gibbs | Nabers + 2026 pick 1.06 | 11 | 0 | 5 | `018a72bb-8ff2-35db-aa13-baabd0705a57` |
| Jan 24, 2026 | Gibbs | Nabers + 2026 pick 1.12 | 14 | 0 | 6 | `dbc70ca4-3c31-3978-ac46-c2618acb4ebf` |

The repository's November 27 trade rebuild also reported 8,216 public trades across 587 league seasons. Its published summary gives aggregate counts. The row-level counts and examples above come from queries where we could examine the assets in both packages. [Earlier collector and evaluation](https://github.com/nikoskiouris/Dynasty-Ticker/pull/478)

### Independent crowd check

KeepTradeCut's November 28, 2026, 05:30 UTC crowd rankings used Superflex, half-PPR, no tight-end premium, and the crowd-only setting (trade blend 0). Its overall ranks below include picks. The points-per-catch difference matters when comparing pass catchers with a full-PPR model. [Rankings](https://keeptradecut.com/dynasty-rankings?format=2&tep=0&blend=0) · [Versioned player pool](https://keeptradecut.com/dynasty-rankings/player-pool?v=2611280530-6366c766508a4f61&sr=2)

| Asset | Crowd price (overall rank) |
| --- | --- |
| Jahmyr Gibbs | 9,999 (1) |
| Malik Nabers | 7,298 (12) |
| 2027 first, early / mid / late | 6,562 (19) / 5,483 (49) / 4,903 (63) |
| Jameson Williams | 4,722 (76) |
| 2027 second, early / mid / late | 3,916 (98) / 3,446 (114) / 3,229 (127) |
| 2028 second, early / mid / late | 3,417 (116) / 3,178 (131) / 3,048 (145) |

Before package adjustment, Nabers plus a mid first totals 12,781 versus Gibbs at 9,999. The two mid seconds total 6,624 versus Williams at 4,722. Each player outranks either individual pick. KTC applies a separate value adjustment to its package verdicts. Its single-asset prices alone cannot establish which package KTC would endorse. [Calculator methodology](https://keeptradecut.com/trade-calculator?format=2&tep=0#value-adjustment)

Running both actual offers through KTC's crowd-only calculator at its standard settings produced different conclusions. **Gibbs vs. Nabers + a 2027 mid first** added 6,239 to Gibbs. The calculator favored Gibbs, 16,238 to 12,781. **Williams vs. the 2027 and 2028 mid seconds** added 1,654 to Williams and called the trade fair, 6,376 to 6,624. KTC requires a pick tier, so both seconds and the first here are conditional mid-round scenarios. [Gibbs offer](https://keeptradecut.com/trade-calculator?var=5&pickVal=0&teamOne=1415&teamTwo=1586%7C1703&format=2&isStartup=0&tep=0&blend=0) · [Williams offer](https://keeptradecut.com/trade-calculator?var=5&pickVal=0&teamOne=1273&teamTwo=1706%7C1886&format=2&isStartup=0&tep=0&blend=0)
