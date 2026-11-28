# Accepted offers at their archived Dynasty Ticker prices

We rebuilt all 47 eligible trades proposed November 14–27, 2026 in the existing independent Sleeper panel. Nineteen leagues made those trades. Every offer had a complete Dynasty Ticker price board from before the proposal. We used the same dated-share calculator that a reader can open from each example below. The first week and the following week are reported separately. No parameter was selected using either window. [League selection and format](package-scale.md#independent-check-on-market-weight-and-consolidation-credit) · [League manifest](market-leagues-independent-2026.txt)

| Proposal dates, UTC | Offers priced | Median absolute gap, listed → credited | Unequal packages | Unequal median absolute gap, listed → credited | Median signed gap toward larger package, listed → credited |
| --- | ---: | ---: | ---: | ---: | ---: |
| Nov 14–20 | 17/17 | 15.4% → 21.0% | 12 | 14.6% → 17.6% | +11.0% → +2.9% |
| Nov 21–27 | 30/30 | 8.1% → 9.6% | 14 | 8.1% → 9.0% | +8.0% → −0.7% |

The historical package credit reduced the median advantage assigned to the side receiving more pieces in both windows. It also increased the typical absolute gap. Managers accepted some offers with large price differences in either direction. These deals give us exchange ratios among participating managers. They cannot tell us who benefited, whether an offer would be rejected, or how much managers valued roster space or an individual pick's eventual slot.

**What a credit changed in two real offers**

- On November 23, Derrick Henry was listed at 41.40 against MarShawn Lloyd, Josh Jacobs and a generic 2028 third totaling 62.73. The 16.01 historical credit raised Henry's side to 57.41. The other side then received 9% more and the calculator labeled the deal Close. [Dated verdict](https://dynastyticker.com/t/2s2026112218343198~11581.5850.p28r3a) · [Sleeper transaction 1430423098183663616](https://api.sleeper.app/v1/league/1347025909739184129/transactions/11)
- On November 19, George Pickens was listed at 115.34 against Harold Fannin Jr. and Makai Lemon totaling 135.38. The historical credit of 60.92 switched the advantage to Pickens, bringing his side to 176.26. The dated verdict was Lopsided, with Pickens' side receiving 30% more. The calculator source from the November 19 release reproduced both examples to the cent after converting its original integer units. [Dated verdict](https://dynastyticker.com/t/2s2026111819258137~12506.13294) · [Sleeper transaction 1428976778025635840](https://api.sleeper.app/v1/league/1350657154389938176/transactions/11) · [Release calculator](https://github.com/nikoskiouris/Dynasty-Ticker/blob/cd20be2/docs/modules/package-value.js)

## Method and scope

The sample contains completed two-manager trades in managed 12-team Superflex PPR dynasty leagues, with four points per passing TD. All players and picks transferred directly between the two teams. Trades involving FAAB were excluded. We used a generic year-and-round quote for each pick and preserved repeated picks. League membership, roster requirements and pick slots can vary. Thirteen leagues contributed in each window and some appear in both.

For each offer we chose the latest archived Superflex board whose valuation timestamp and first commit on the integration branch both preceded the proposal. We read the board from that first commit. We set a 72-hour age limit. The oldest matched board was 25.6 hours old. A commit establishes when the repository contained a board. The replay makes no assumption about whether the managers opened the site. Sixteen trades used football-forecast-v2 archives, 28 used forecast-consensus-blend-v1 and three used sleeper-trades-v4. Those versions precede the November 28 model. These November transactions also fall in the later-season market study of the same independent panel, so the two studies overlap. Historical integer prices are displayed divided by 100 and can exceed 100. [Pinned archive and model metadata](https://github.com/nikoskiouris/Dynasty-Ticker/blob/7aa07060e79b298a3722ef9561acf7d47ecbe21e/docs/data/price-history/index.json)

The table divides the absolute difference in side totals by their sum. Its signed version subtracts the total on the side receiving fewer assets from the total on the side receiving more. The calculator headline divides by the smaller side to say how much more one side received. Each calculation uses the same credited totals. [Dated-share implementation](../../docs/modules/trade-share.js)

## Reproduce

From the repository root, use the full Git history, Python 3.10+ and Node.js. The first command collects the independent panel and also runs the separate later-season market study. The second uses the exported deals and Git archive locally and prints transaction links, dated share paths, side totals and individual verdicts. [Collector](market_packages.py) · [Archive replay](archived_trade_replay.mjs)

```sh
python3 player-values/research/market_packages.py --independent-panel --later-packages --save-deals /tmp/dynasty-independent-full.json
node player-values/research/archived_trade_replay.mjs /tmp/dynasty-independent-full.json
```
