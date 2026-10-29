# One measured single/multi-agent example

An exploratory three-module migration produced passing evaluator results in both modes:

| Measurement | Single | Multi |
|---|---:|---:|
| Reported input + output tokens | 301,450 | 765,494 |
| Elapsed time to evaluator | 181.127 s | 259.913 s |
| Evaluator milestones passed | 5/5 | 5/5 |

In this pair, the multi-agent workflow used 2.54 times the tokens and took 43.5% longer. Its critical path included contract work before service/client could run in parallel. The measurements do not isolate the cause of the difference.

This is one task and one pair, with single run before multi, default model settings not independently verified, uncontrolled cache/order effects, and no equal-token budget or fault injection. It does not establish general multi-agent inferiority, dollar costs or reliability. Raw private logs are not shipped in the public product source.

TraceLens's value is making these distinctions inspectable. A prettier timeline alone does not establish that an agent workflow improved.
