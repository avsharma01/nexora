from calendar import monthrange
from datetime import date, datetime, timezone
from math import sqrt

from sqlalchemy.orm import Session

from app.models.kpi import KPI
from app.schemas.forecast import (
    ForecastPoint,
    ForecastResponse,
)


MODEL_NAME = "linear_trend_v1"
MINIMUM_HISTORY = 3


def _month_index(start: date, current: date) -> int:
    return (current.year - start.year) * 12 + current.month - start.month


def _add_months(value: date, months: int) -> date:
    month_index = value.year * 12 + value.month - 1 + months
    year, month = divmod(month_index, 12)
    month += 1
    return date(year, month, min(value.day, monthrange(year, month)[1]))


def _fit_line(xs: list[float], ys: list[float]) -> tuple[float, float]:
    x_mean = sum(xs) / len(xs)
    y_mean = sum(ys) / len(ys)
    denominator = sum((x - x_mean) ** 2 for x in xs)
    slope = (
        sum((x - x_mean) * (y - y_mean) for x, y in zip(xs, ys))
        / denominator
        if denominator
        else 0.0
    )
    return y_mean - slope * x_mean, slope


def get_forecast(
    db: Session,
    company_id: int,
    metric_name: str,
    periods: int,
) -> ForecastResponse:
    kpis = (
        db.query(KPI)
        .filter(
            KPI.company_id == company_id,
            KPI.metric_name == metric_name,
        )
        .order_by(KPI.metric_date.asc(), KPI.id.asc())
        .all()
    )

    # A same-day correction is represented by the last inserted value. This
    # also prevents duplicate dates from overweighting the fitted trend.
    by_date: dict[date, float] = {}
    for kpi in kpis:
        by_date[kpi.metric_date] = float(kpi.metric_value)
    observations = sorted(by_date.items())

    if not observations:
        return ForecastResponse(
            company_id=company_id,
            metric_name=metric_name,
            historical_latest_value=None,
            history_points=0,
            minimum_history=MINIMUM_HISTORY,
            status="insufficient_data",
            model_name=None,
            generated_at=datetime.now(timezone.utc),
            evaluation=None,
            forecasts=[],
        )

    dates = [item[0] for item in observations]
    values = [item[1] for item in observations]
    latest_value = values[-1]
    if len(values) < MINIMUM_HISTORY:
        return ForecastResponse(
            company_id=company_id,
            metric_name=metric_name,
            historical_latest_value=latest_value,
            history_points=len(values),
            minimum_history=MINIMUM_HISTORY,
            status="insufficient_data",
            model_name=None,
            generated_at=datetime.now(timezone.utc),
            evaluation=None,
            forecasts=[],
        )

    start_date = dates[0]
    xs = [float(_month_index(start_date, observed_date)) for observed_date in dates]
    intercept, slope = _fit_line(xs, values)
    residuals = [
        actual - (intercept + slope * x)
        for x, actual in zip(xs, values)
    ]
    # Residual spread provides a simple, transparent prediction band. It is
    # not a calibrated statistical confidence interval.
    residual_rmse = sqrt(sum(error * error for error in residuals) / len(residuals))

    # One-step rolling-origin evaluation, using only prior observations at
    # every step so reported errors do not come from fitting on the test point.
    absolute_errors: list[float] = []
    percentage_errors: list[float] = []
    for test_index in range(2, len(values)):
        train_x = xs[:test_index]
        train_y = values[:test_index]
        train_intercept, train_slope = _fit_line(train_x, train_y)
        predicted = train_intercept + train_slope * xs[test_index]
        error = abs(values[test_index] - predicted)
        absolute_errors.append(error)
        if values[test_index] != 0:
            percentage_errors.append(error / abs(values[test_index]) * 100)

    forecasts = []
    last_index = xs[-1]
    for period in range(1, periods + 1):
        future_index = last_index + period
        predicted_value = intercept + slope * future_index
        # Widen the band with horizon to communicate increasing uncertainty.
        spread = residual_rmse * sqrt(1 + period / len(values))
        forecasts.append(
            ForecastPoint(
                forecast_date=_add_months(dates[-1], period),
                forecast_value=predicted_value,
                lower_bound=predicted_value - 1.96 * spread,
                upper_bound=predicted_value + 1.96 * spread,
                model_name=MODEL_NAME,
            )
        )

    return ForecastResponse(
        company_id=company_id,
        metric_name=metric_name,
        historical_latest_value=latest_value,
        history_points=len(values),
        minimum_history=MINIMUM_HISTORY,
        status="forecasted",
        model_name=MODEL_NAME,
        generated_at=datetime.now(timezone.utc),
        evaluation={
            "backtest_points": len(absolute_errors),
            "mae": sum(absolute_errors) / len(absolute_errors)
            if absolute_errors
            else None,
            "mape": sum(percentage_errors) / len(percentage_errors)
            if percentage_errors
            else None,
        },
        forecasts=forecasts,
    )
