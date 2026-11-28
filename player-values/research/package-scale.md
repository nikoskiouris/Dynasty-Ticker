# How the new scale prices accepted packages

We reconstructed the August 26, 2026 preseason football and market board, then ran v4 and v5 on the same inputs. The sample contains completed, two-manager Sleeper trades that transferred players or picks directly between the two teams. We required proposal and acceptance to follow the forecast. Through Week 2, 117 of 124 offers had a positive value for every asset under both versions and a dated independent quote; 72 involved unequal numbers of pieces, and 27 were two-for-ones. The 117 offers came from 53 leagues. Only two of the 72 unequal trades excluded picks. Each future pick received its generic year-and-round price because its final slot was unknown. [Input archives and exact forecast time](preseason-trades.md) · [League settings and sampling](market-packages.md)

For each trade, we compared the listed totals and then the totals from each release's calculator, which applies its consolidation credit. The calculator received the price of the highest-valued player on its own reconstructed board. We measured the median absolute gap, `abs(left − right) / (left + right)`, and the median signed gap between the side receiving more pieces and the other side. A positive signed gap favors the side with more pieces. A gap of 10% corresponds to side totals of 55 and 45. [Calculator implementation](../../docs/modules/package-value.js)

The preseason sample ended at the first league-wide kickoff on September 10. A second, disjoint sample covered acceptances after kickoff through September 22 at 06:00 UTC with the August board still frozen. Prices do not incorporate information learned during play in that window. We also checked unequal packages containing a player ranked in v4's top 12, fixed before the comparison. That group had ten trades across nine leagues. The variation across those deals is large, and managers can reasonably accept a trade with a large modeled gap.

## Prices and calculator results

| Trades through Week 2 | Deals | V4 listed gap | V5 listed gap | V4 credited gap | V5 credited gap |
| --- | ---: | ---: | ---: | ---: | ---: |
| All covered | 117 | 16.9% | 16.4% | 17.9% | 16.6% |
| Unequal piece counts | 72 | 16.2% | 14.4% | 16.6% | 15.1% |
| Two for one | 27 | 24.3% | 21.1% | 26.3% | 24.8% |
| Unequal and includes a top-12 player | 10 | 17.1% | 7.9% | 20.6% | 11.4% |

The unequal packages showed a 2.6% signed median gap toward the larger package on listed v5 prices. After the calculator applied its consolidation credit, that moved to 1.6% toward the smaller package. V4 moved from 2.3% toward the larger package to 2.0% toward the smaller package. Across the 72 unequal trades, only one changed which side had the higher credited total. Credited top-12 exchanges still favored the side with fewer pieces by 6.9% at the median, compared with 19.1% under v4.

Before opening kickoff, the median credited gap fell from 15.8% to 13.7% on 42 unequal packages. After kickoff, it fell from 23.2% to 16.5% on the other 30. Across the combined sample, the league-bootstrap interval for the difference in median credited gaps ran from −5.2 to +0.0 percentage points. Two-for-ones still had a 24.8% median credited gap. Individual offers can differ substantially from the model's trade totals.

During development we compared two prototype scales on these accepted trades. Both used the same three upper reference bands. One added a fourth reference at historical rank 48; the other kept the lower range proportional up to the first upper reference. In the fourth-reference prototype the 72 deals favored the smaller package by 7.6% after calculator credit; the proportional alternative cut that to 1.6%. We retained the proportional lower range and the existing calculator credit. These 2026 transactions informed that decision, so the table is a replay of model behavior on a selection sample. Later market-only checks use time-matched quotes. [Reference construction](elite_score_bands.py) · [Later market-only trades](market-packages.md)

## Player-only check in 2023 and 2024

We replayed football-only preseason boards against player-only exchanges in a separately sampled set of leagues. The 2023 and 2024 samples total 31 priced trades. No matching historical market quotes were used. In 2023, six unequal packages had a median credited gap of 11.0% under v4 and 10.1% under v5. In 2024, the corresponding median rounded to 15.3% in both models across seven packages. Across all deal sizes, the median credited gap went from 11.6% to 10.4% in 2023 and rounded to 21.3% in both models in 2024. Only seven trades across both seasons were two-for-ones. [Archived input dates, scoring and league selection](trade-spacing.md)

## Reproduction

From the repository root, use Python 3.10+, Git, Node.js and the repository history containing v4 commit `7837cf04672c393355c50dc6bacfc8f056f0a2ee`.

```sh
python3 player-values/research/market_packages.py --save-deals /tmp/dynasty-accepted-trades.json
python3 player-values/research/package_scale.py /tmp/dynasty-accepted-trades.json --historical-players
```

The [replay](package_scale.py) loads v4 and its calculator from the pinned Git revision. It calls both the current production model and the JavaScript calculator for v5. For unequal packages the CLI also resamples whole leagues 1,000 times using a fixed seed and reports the central 95% of the resulting differences in median credited gap. The sampling frame is connected, several managers participate in multiple leagues, and all transactions were accepted. The resulting interval describes variation within this panel.
