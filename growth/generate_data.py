"""Datos sintéticos de FinDemo, una fintech colombiana ficticia.

Simula las fuentes que tendría un equipo de growth real:
- GA4: sesiones con canal, fuente/medio y campaña.
- App / core: registro, KYC, aprobación y primer depósito.
- HubSpot: contactos con etapa del ciclo de vida y fuente original.
- Plataformas de pauta: inversión diaria por canal.
- Core transaccional: transacciones y saldos mensuales.
- Herramienta de experimentación: asignaciones de A/B tests.

Las relaciones entre variables están diseñadas para que los análisis
tengan algo que encontrar (p. ej. canales que inician journeys pero no
cierran, o canales baratos con clientes de baja calidad).
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from . import config

CHANNELS = [
    "Paid Search", "Paid Social", "TikTok Ads", "Afiliados",
    "Email", "Orgánico", "Directo", "Referidos",
]

# canal -> (source, medium, campañas)
CHANNEL_META = {
    "Paid Search": ("google", "cpc", ["brand_cuenta", "nonbrand_cuenta_ahorros", "nonbrand_tarjeta"]),
    "Paid Social": ("facebook", "paid_social", ["prospecting_lookalike", "retargeting_web"]),
    "TikTok Ads": ("tiktok", "paid_social", ["awareness_genz", "app_install"]),
    "Afiliados": ("partners", "affiliate", ["comparador_financiero", "influencers"]),
    "Email": ("hubspot", "email", ["nurturing_registro", "newsletter"]),
    "Orgánico": ("google", "organic", ["(organic)"]),
    "Directo": ("(direct)", "(none)", ["(direct)"]),
    "Referidos": ("app_referidos", "referral", ["programa_referidos"]),
}

HUBSPOT_SOURCE = {
    "Paid Search": "PAID_SEARCH", "Paid Social": "PAID_SOCIAL", "TikTok Ads": "PAID_SOCIAL",
    "Afiliados": "OTHER_CAMPAIGNS", "Email": "EMAIL_MARKETING", "Orgánico": "ORGANIC_SEARCH",
    "Directo": "DIRECT_TRAFFIC", "Referidos": "REFERRALS",
}

# Mezcla de canales del primer toque y de los toques siguientes.
# Los canales sociales abren journeys; Email, Directo y Search los cierran.
FIRST_TOUCH_MIX = {
    "Paid Search": 0.20, "Paid Social": 0.22, "TikTok Ads": 0.14, "Afiliados": 0.09,
    "Email": 0.00, "Orgánico": 0.20, "Directo": 0.05, "Referidos": 0.10,
}
FOLLOW_UP_MIX = {
    "Paid Search": 0.20, "Paid Social": 0.10, "TikTok Ads": 0.04, "Afiliados": 0.05,
    "Email": 0.24, "Orgánico": 0.12, "Directo": 0.22, "Referidos": 0.03,
}

# Efecto (en logit) de que el canal aparezca en el journey sobre la probabilidad de registro.
SIGNUP_BASE_LOGIT = -3.0
SIGNUP_LIFT = {
    "Paid Search": 0.55, "Paid Social": 0.45, "TikTok Ads": 0.35, "Afiliados": 0.40,
    "Email": 0.55, "Orgánico": 0.40, "Directo": 0.25, "Referidos": 0.95,
}
KYC_RATE = 0.60
KYC_LIFT_VARIANT_B = 0.07
APPROVAL_RATE = 0.86
# Probabilidad de primer depósito según canal del primer toque (calidad del lead)
DEPOSIT_RATE = {
    "Paid Search": 0.72, "Paid Social": 0.66, "TikTok Ads": 0.55, "Afiliados": 0.48,
    "Email": 0.70, "Orgánico": 0.76, "Directo": 0.74, "Referidos": 0.84,
}
# canal del primer toque -> (multiplicador de actividad, hazard mensual de churn)
QUALITY = {
    "Paid Search": (1.00, 0.040), "Paid Social": (0.90, 0.055), "TikTok Ads": (0.75, 0.085),
    "Afiliados": (0.70, 0.110), "Email": (1.00, 0.040), "Orgánico": (1.15, 0.030),
    "Directo": (1.10, 0.035), "Referidos": (1.25, 0.025),
}
CARD_ADOPTION = 0.55  # fracción de clientes que usa la tarjeta débito

CPC = {"Paid Search": 3_800, "Paid Social": 1_600, "TikTok Ads": 900}
AFFILIATE_CPA = 70_000
REFERRAL_BONUS = 30_000
FIXED_MONTHLY = {"Email": 2_500_000, "Orgánico": 3_500_000}  # HubSpot + equipo SEO/contenido
PLATFORM = {
    "Paid Search": "Google Ads", "Paid Social": "Meta Ads", "TikTok Ads": "TikTok Ads",
    "Afiliados": "Red de afiliados", "Email": "HubSpot", "Orgánico": "SEO / contenido",
    "Referidos": "Programa de referidos",
}

DEVICES = (["mobile", "desktop", "tablet"], [0.72, 0.25, 0.03])
CITIES = (["Bogotá", "Medellín", "Cali", "Barranquilla", "Bucaramanga", "Otras"],
          [0.38, 0.18, 0.11, 0.08, 0.05, 0.20])
AGE_BANDS = (["18-24", "25-34", "35-44", "45-54", "55+"], [0.22, 0.36, 0.22, 0.12, 0.08])
LANDING_PAGES = (["/", "/cuenta-ahorros", "/tarjeta-debito", "/referidos", "/blog"],
                 [0.35, 0.25, 0.18, 0.07, 0.15])
# tipo -> (probabilidad, take rate)
TX_TYPES = {
    "Transferencia": (0.38, 0.000), "Pago QR": (0.22, 0.004), "Compra tarjeta": (0.25, 0.014),
    "Pago servicios": (0.10, 0.002), "Recarga celular": (0.05, 0.030),
}


def _keys_probs(mix: dict) -> tuple[list, np.ndarray]:
    keys = list(mix)
    p = np.array([mix[k] for k in keys], dtype=float)
    return keys, p / p.sum()


def _sigmoid(x):
    return 1.0 / (1.0 + np.exp(-x))


def generate(n_users: int = config.N_USERS, seed: int = config.SEED) -> dict[str, pd.DataFrame]:
    """Genera todas las tablas crudas. Devuelve {nombre_tabla: DataFrame}."""
    rng = np.random.default_rng(seed)
    users = _generate_users(rng, n_users)
    sessions = _generate_sessions(rng, users)
    customers, ab_onboarding = _generate_funnel(rng, users, sessions)
    transactions, balances, ab_email = _generate_activity(rng, customers)
    spend = _generate_spend(rng, sessions, customers)
    crm = _generate_crm(rng, customers)
    return {
        "ga4_sessions": sessions,
        "app_customers": customers,
        "hubspot_contacts": crm,
        "ad_spend": spend,
        "core_transactions": transactions,
        "core_balances": balances,
        "ab_assignments": pd.concat([ab_onboarding, ab_email], ignore_index=True),
    }


def _generate_users(rng, n_users: int) -> pd.DataFrame:
    dates = pd.date_range(config.START_DATE, config.ACQ_END, freq="D")
    # tendencia de crecimiento, menos tráfico en fin de semana y picos de prima (jun/dic)
    weights = np.linspace(1.0, 1.7, len(dates))
    weights *= np.where(dates.dayofweek < 5, 1.0, 0.8)
    weights *= np.where(np.isin(dates.month, [6, 12]), 1.2, 1.0)
    day_idx = rng.choice(len(dates), size=n_users, p=weights / weights.sum())
    first_touch_at = dates[day_idx] + pd.to_timedelta(rng.uniform(7, 23, n_users), unit="h")
    return pd.DataFrame({
        "user_id": [f"U{i:06d}" for i in range(1, n_users + 1)],
        "first_touch_at": first_touch_at,
        "device": rng.choice(DEVICES[0], n_users, p=DEVICES[1]),
        "city": rng.choice(CITIES[0], n_users, p=CITIES[1]),
        "age_band": rng.choice(AGE_BANDS[0], n_users, p=AGE_BANDS[1]),
    })


def _generate_sessions(rng, users: pd.DataFrame) -> pd.DataFrame:
    n_users = len(users)
    n_touch = np.minimum(rng.geometric(0.42, n_users), 8)
    user_idx = np.repeat(np.arange(n_users), n_touch)
    pos = pd.Series(user_idx).groupby(user_idx).cumcount().to_numpy()
    n_rows = len(user_idx)

    first_keys, first_p = _keys_probs(FIRST_TOUCH_MIX)
    follow_keys, follow_p = _keys_probs(FOLLOW_UP_MIX)
    channel = np.where(
        pos == 0,
        rng.choice(first_keys, n_rows, p=first_p),
        rng.choice(follow_keys, n_rows, p=follow_p),
    )

    gaps = np.where(pos == 0, 0.0, rng.exponential(2.5, n_rows))
    offset_days = pd.Series(gaps).groupby(user_idx).cumsum().to_numpy()
    session_start = users["first_touch_at"].to_numpy()[user_idx] + pd.to_timedelta(offset_days, unit="D")

    source = np.empty(n_rows, dtype=object)
    medium = np.empty(n_rows, dtype=object)
    campaign = np.empty(n_rows, dtype=object)
    for ch, (src, med, camps) in CHANNEL_META.items():
        mask = channel == ch
        source[mask] = src
        medium[mask] = med
        campaign[mask] = rng.choice(camps, mask.sum())

    sessions = pd.DataFrame({
        "session_id": [f"S{i:07d}" for i in range(1, n_rows + 1)],
        "user_id": users["user_id"].to_numpy()[user_idx],
        "session_start": pd.to_datetime(session_start).round("s"),
        "channel_group": channel,
        "source": source,
        "medium": medium,
        "campaign": campaign,
        "device": users["device"].to_numpy()[user_idx],
        "city": users["city"].to_numpy()[user_idx],
        "landing_page": rng.choice(LANDING_PAGES[0], n_rows, p=LANDING_PAGES[1]),
        "engaged_session": rng.random(n_rows) < 0.62,
    })
    return sessions


def _generate_funnel(rng, users: pd.DataFrame, sessions: pd.DataFrame):
    by_user = sessions.sort_values("session_start").groupby("user_id")
    presence = (pd.crosstab(sessions["user_id"], sessions["channel_group"])
                .reindex(index=users["user_id"], columns=CHANNELS, fill_value=0) > 0)
    lift = presence.to_numpy() @ np.array([SIGNUP_LIFT[c] for c in CHANNELS])
    n_touch = by_user.size().reindex(users["user_id"]).to_numpy()
    first_channel = by_user["channel_group"].first().reindex(users["user_id"]).to_numpy()
    last_touch_at = by_user["session_start"].max().reindex(users["user_id"]).to_numpy()

    n = len(users)
    logit = (SIGNUP_BASE_LOGIT + lift + 0.12 * (n_touch - 1)
             + 0.2 * (users["device"].to_numpy() == "desktop"))
    signup = rng.random(n) < _sigmoid(logit)
    signup_at = pd.Series(last_touch_at) + pd.to_timedelta(rng.uniform(2, 40, n), unit="m")

    test = config.AB_TESTS["AB01_onboarding_kyc"]
    in_test = signup & (signup_at >= test["inicio"]).to_numpy() & (signup_at < test["fin"] + pd.Timedelta(days=1)).to_numpy()
    variant = np.where(in_test, rng.choice(["A", "B"], n), None)

    p_kyc = KYC_RATE + KYC_LIFT_VARIANT_B * (variant == "B")
    kyc = signup & (rng.random(n) < p_kyc)
    approved = kyc & (rng.random(n) < APPROVAL_RATE)
    deposit_p = np.array([DEPOSIT_RATE[c] for c in first_channel])
    activated = approved & (rng.random(n) < deposit_p)

    kyc_at = signup_at + pd.to_timedelta(rng.exponential(0.8, n), unit="D")
    approved_at = kyc_at + pd.to_timedelta(rng.exponential(0.4, n), unit="D")
    activated_at = approved_at + pd.to_timedelta(rng.exponential(2.5, n), unit="D")

    customers = pd.DataFrame({
        "user_id": users["user_id"],
        "signup_at": signup_at.round("s"),
        "kyc_completed_at": kyc_at.round("s").where(kyc),
        "approved_at": approved_at.round("s").where(approved),
        "first_deposit_at": activated_at.round("s").where(activated),
        "device": users["device"],
        "city": users["city"],
        "age_band": users["age_band"],
        "first_channel": first_channel,  # auxiliar; no se exporta
    })[signup].reset_index(drop=True)

    ab = pd.DataFrame({
        "test_id": "AB01_onboarding_kyc",
        "user_id": users["user_id"][in_test],
        "variant": variant[in_test],
        "assigned_at": signup_at[in_test].round("s"),
    })
    return customers, ab


def _generate_activity(rng, customers: pd.DataFrame):
    snapshot = config.SNAPSHOT_DATE
    end_ts = snapshot + pd.Timedelta(days=1)
    snapshot_month = snapshot.to_period("M")
    test = config.AB_TESTS["AB02_email_bienvenida"]
    tx_keys, tx_p = _keys_probs({k: v[0] for k, v in TX_TYPES.items()})
    _, tx_p_no_card = _keys_probs({k: (0 if k == "Compra tarjeta" else v[0]) for k, v in TX_TYPES.items()})

    active = customers[customers["first_deposit_at"].notna()]
    tx_cust, tx_ts, tx_type, tx_amount = [], [], [], []
    bal_rows, ab_rows = [], []

    for row in active.itertuples(index=False):
        mult, hazard = QUALITY[row.first_channel]
        if row.age_band == "18-24":
            mult, hazard = mult * 1.1, hazard * 1.25
        frailty = rng.gamma(2.0, 0.5)
        lam = 4.2 * mult * frailty
        type_p = tx_p if rng.random() < CARD_ADOPTION else tx_p_no_card
        act_at = row.first_deposit_at

        variant = None
        if test["inicio"] <= act_at < test["fin"] + pd.Timedelta(days=1):
            variant = rng.choice(["A", "B"])
            ab_rows.append(("AB02_email_bienvenida", row.user_id, variant, act_at))

        # primer depósito
        tx_cust.append([row.user_id])
        tx_ts.append(np.array([act_at.value]))
        tx_type.append(["Depósito inicial"])
        tx_amount.append([round(rng.lognormal(np.log(150_000), 0.8), -2)])

        m0 = act_at.to_period("M")
        for k in range((snapshot_month - m0).n + 1):
            if k > 0:
                h = hazard * (1.8 if k == 1 else 1.0)  # el churn temprano es mayor
                if variant == "B" and k <= 2:
                    h *= 0.85
                if rng.random() < h:
                    break
            month = m0 + k
            month_start, month_end = month.to_timestamp(), (month + 1).to_timestamp()
            lo = act_at if k == 0 else month_start
            hi = min(month_end, end_ts)
            frac = (hi - lo) / (month_end - month_start)
            n_tx = rng.poisson(lam * frac)
            if n_tx:
                tx_cust.append([row.user_id] * n_tx)
                tx_ts.append(rng.integers(lo.value, hi.value, n_tx))
                tx_type.append(rng.choice(tx_keys, n_tx, p=type_p))
                tx_amount.append(np.round(rng.lognormal(np.log(85_000), 0.9, n_tx), -2))
            balance = rng.lognormal(np.log(1_400_000 * mult * np.sqrt(frailty)), 0.7)
            bal_rows.append((row.user_id, month_start.date(), round(balance, -2)))

    transactions = pd.DataFrame({
        "customer_id": np.concatenate(tx_cust),
        "transaction_at": pd.to_datetime(np.concatenate(tx_ts)).round("s"),
        "transaction_type": np.concatenate(tx_type),
        "amount_cop": np.concatenate(tx_amount),
    }).sort_values("transaction_at").reset_index(drop=True)
    take_rate = transactions["transaction_type"].map({k: v[1] for k, v in TX_TYPES.items()}).fillna(0)
    transactions["fee_revenue_cop"] = (transactions["amount_cop"] * take_rate).round(0)
    transactions.insert(0, "transaction_id", [f"T{i:08d}" for i in range(1, len(transactions) + 1)])

    balances = pd.DataFrame(bal_rows, columns=["customer_id", "month", "avg_balance_cop"])
    ab = pd.DataFrame(ab_rows, columns=["test_id", "user_id", "variant", "assigned_at"])
    return transactions, balances, ab


def _generate_spend(rng, sessions: pd.DataFrame, customers: pd.DataFrame) -> pd.DataFrame:
    parts = []
    day = sessions["session_start"].dt.normalize()
    paid = sessions[sessions["channel_group"].isin(CPC)]
    clicks = paid.groupby([day[paid.index], "channel_group"]).size().rename("clicks").reset_index()
    clicks.columns = ["date", "channel", "clicks"]
    clicks["spend_cop"] = (clicks["clicks"] * clicks["channel"].map(CPC)
                           * rng.lognormal(0, 0.12, len(clicks)))
    parts.append(clicks[["date", "channel", "spend_cop"]])

    activated = customers[customers["first_deposit_at"].notna()]
    for channel, unit_cost in [("Afiliados", AFFILIATE_CPA), ("Referidos", REFERRAL_BONUS)]:
        sub = activated[activated["first_channel"] == channel]
        daily = sub.groupby(sub["first_deposit_at"].dt.normalize()).size() * unit_cost
        parts.append(pd.DataFrame({"date": daily.index, "channel": channel, "spend_cop": daily.to_numpy()}))

    dates = pd.date_range(config.START_DATE, config.ACQ_END, freq="D")
    for channel, monthly in FIXED_MONTHLY.items():
        parts.append(pd.DataFrame({"date": dates, "channel": channel,
                                   "spend_cop": monthly / dates.days_in_month}))

    spend = pd.concat(parts, ignore_index=True)
    spend = spend[spend["date"] <= config.ACQ_END]
    spend["platform"] = spend["channel"].map(PLATFORM)
    spend["spend_cop"] = spend["spend_cop"].round(0)
    return spend.sort_values(["date", "channel"]).reset_index(drop=True)


def _generate_crm(rng, customers: pd.DataFrame) -> pd.DataFrame:
    stage = np.select(
        [customers["first_deposit_at"].notna(), customers["approved_at"].notna(),
         customers["kyc_completed_at"].notna()],
        ["customer", "opportunity", "marketingqualifiedlead"],
        default="lead",
    )
    source = customers["first_channel"].map(HUBSPOT_SOURCE).to_numpy().astype(object)
    # Ruido realista: registros cargados a mano sin fuente o marcados OFFLINE.
    noise = rng.random(len(customers))
    source[noise < 0.02] = "OFFLINE"
    source[(noise >= 0.02) & (noise < 0.035)] = None
    contacts = pd.DataFrame({
        "contact_id": np.arange(100_001, 100_001 + len(customers)),
        "user_id": customers["user_id"],
        "createdate": customers["signup_at"],
        "lifecyclestage": stage,
        "hs_analytics_source": source,
        "email_opt_in": rng.random(len(customers)) < 0.81,
    })
    # Duplicados típicos de integraciones (mismo user_id con otro contact_id)
    dup = contacts.sample(frac=0.004, random_state=1).copy()
    dup["contact_id"] = np.arange(900_001, 900_001 + len(dup))
    return pd.concat([contacts, dup], ignore_index=True)
