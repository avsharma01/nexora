# Sample import: Tamarind Lane Coffee Co.

A **fictional** company for demoing the CSV import (New company → Monthly financial records).
All figures are synthetic and in **INR**.

| Field | Value |
|---|---|
| Company name | Tamarind Lane Coffee Co. |
| Industry | Food & Beverage (D2C coffee) |
| Description | Bengaluru-based direct-to-consumer specialty coffee brand. Sells freshly roasted single-estate beans, cold brew and brewing gear through its website and quick-commerce apps, and runs six experience cafés in Bengaluru and Pune. |
| File | `tamarind-lane-coffee.csv`: 37 months (Oct 2023 to Oct 2026), 12 metrics |

## Metrics

| Column | Meaning | Quarters / years |
|---|---|---|
| revenue, expenses, profit | Monthly P&L (INR) | total |
| orders | Orders shipped or served | total |
| average_order_value | Revenue ÷ orders (INR) | monthly average |
| customers | Active customers (bought in the last 90 days) | end of period |
| new_customers | First-time buyers that month | total |
| repeat_purchase_rate | % of orders from returning customers | monthly average |
| marketing_spend | Performance + brand marketing (INR) | total |
| headcount | Employees at month end | end of period |
| cash_balance | Cash in the bank at month end (INR) | end of period |

## The story in the data (good demo questions)

- **Festive peaks:** revenue jumps every Oct to Dec (Diwali and gifting); average order value is highest in December.
- **Series A, Jun 2024:** cash balance rises by about ₹25 Cr.
- **Expansion losses:** two cafés open in Jul 2024 and two more in Feb 2025. Q1 2025 is the low point (Feb 2025 margin about −20%), with a headcount jump and fit-out costs.
- **"Brew Bold" campaign, Apr to May 2025:** marketing spend and new customers spike; the repeat purchase rate dips because of the influx of first-time buyers.
- **Hiring freeze, Jun to Sep 2025:** headcount stays at 92.
- **Profitable 2026:** the margin recovers to about 11 to 12% by Sep to Oct 2026; repeat purchase rate climbs from about 31% to 44% over three years.

Try asking the AI analyst: "How many customers did we have in Q3 2026?", "What was marketing spend in April 2025?",
"How did the repeat purchase rate trend over the last 12 months?", "Compare orders in 2025 and 2026",
"What is our cash balance?", "Why did profit drop in February 2025?"
