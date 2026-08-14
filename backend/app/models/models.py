from datetime import datetime, date
from sqlalchemy import (
    Column, String, Integer, Float, Boolean, Text, DateTime, Date,
    ForeignKey, Numeric, JSON, UniqueConstraint, Index
)
from sqlalchemy.orm import relationship
from ..db.base import Base


# ── Currencies ──────────────────────────────────────────────────────
class Currency(Base):
    __tablename__ = "currencies"
    code = Column(String(3), primary_key=True)
    name = Column(String(50), nullable=False)
    symbol = Column(String(5), nullable=False)
    decimal_places = Column(Integer, default=2)
    number_format_style = Column(String(10), default="indian")


# ── Exchange Rates ──────────────────────────────────────────────────
class ExchangeRate(Base):
    __tablename__ = "exchange_rates"
    id = Column(Integer, primary_key=True, autoincrement=True)
    currency_code = Column(String(3), ForeignKey("currencies.code"), nullable=False)
    rate_to_base = Column(Numeric(14, 6), nullable=False)
    effective_date = Column(Date, nullable=False)
    source = Column(String(50), default="manual")
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("currency_code", "effective_date"),
    )


# ── Roles ──────────────────────────────────────────────────────────
class Role(Base):
    __tablename__ = "roles"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(50), unique=True, nullable=False)
    description = Column(String(200), default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    permissions = relationship("Permission", secondary="role_permissions", back_populates="roles")


# ── Permissions ────────────────────────────────────────────────────
class Permission(Base):
    __tablename__ = "permissions"
    id = Column(Integer, primary_key=True, autoincrement=True)
    resource = Column(String(50), nullable=False)
    action = Column(String(20), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    roles = relationship("Role", secondary="role_permissions", back_populates="permissions")

    __table_args__ = (
        UniqueConstraint("resource", "action"),
    )


# ── Role ↔ Permission join ─────────────────────────────────────────
class RolePermission(Base):
    __tablename__ = "role_permissions"
    role_id = Column(Integer, ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True)
    permission_id = Column(Integer, ForeignKey("permissions.id", ondelete="CASCADE"), primary_key=True)


# ── Users ──────────────────────────────────────────────────────────
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    email = Column(String(200), unique=True, nullable=False, index=True)
    password_hash = Column(String(200), nullable=False)
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=False)
    is_active = Column(Boolean, default=True)
    invite_token = Column(String(200), nullable=True)
    invite_expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    role = relationship("Role", backref="users")
    store_access = relationship("UserStoreAccess", back_populates="user", cascade="all, delete-orphan")


# ── User ↔ Store access ───────────────────────────────────────────
class UserStoreAccess(Base):
    __tablename__ = "user_store_access"
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    store_id = Column(Integer, ForeignKey("stores.id", ondelete="CASCADE"), primary_key=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="store_access")
    store = relationship("Store", back_populates="users_with_access")


# ── Stores ─────────────────────────────────────────────────────────
class Store(Base):
    __tablename__ = "stores"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    team_leader_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    currency_code = Column(String(3), ForeignKey("currencies.code"), default="INR")
    daily_target = Column(Numeric(14, 2), default=0)
    monthly_target = Column(Numeric(14, 2), default=0)
    breakeven_revenue = Column(Numeric(14, 2), default=0)
    profitability_target = Column(Numeric(14, 2), default=0)
    fixed_costs = Column(Numeric(14, 2), default=0)
    variable_cost_pct = Column(Numeric(5, 2), default=0)
    is_active = Column(Boolean, default=True)
    region = Column(String(50), default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    team_leader = relationship("User", foreign_keys=[team_leader_id])
    currency = relationship("Currency", backref="stores")
    users_with_access = relationship("UserStoreAccess", back_populates="store")


# ── Daily Submissions ──────────────────────────────────────────────
class DailySubmission(Base):
    __tablename__ = "daily_submissions"
    id = Column(Integer, primary_key=True, autoincrement=True)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=False)
    date = Column(Date, nullable=False)
    revenue = Column(Numeric(14, 2), default=0)
    units_sold = Column(Integer, default=0)
    care_plus_attached = Column(Integer, default=0)
    new_leads = Column(Integer, default=0)
    active_leads = Column(Integer, default=0)
    calls_made = Column(Integer, default=0)
    calls_connected = Column(Integer, default=0)
    walk_ins = Column(Integer, default=0)
    walk_in_conversions = Column(Integer, default=0)
    staff_on_duty = Column(Integer, default=0)
    training_done = Column(Boolean, default=False)
    training_topic = Column(String(200), default="")
    stock_opening = Column(Integer, default=0)
    stock_received = Column(Integer, default=0)
    stock_sold = Column(Integer, default=0)
    stock_closing = Column(Integer, default=0)
    stock_variance = Column(Integer, default=0)
    cash_opening = Column(Numeric(14, 2), default=0)
    cash_sales = Column(Numeric(14, 2), default=0)
    bank_deposit = Column(Numeric(14, 2), default=0)
    petty_cash_note = Column(Text, default="")
    cash_closing = Column(Numeric(14, 2), default=0)
    installations = Column(Integer, default=0)
    service_calls = Column(Integer, default=0)
    complaints_in = Column(Integer, default=0)
    complaints_resolved = Column(Integer, default=0)
    app_updated = Column(Boolean, default=False)
    notes = Column(Text, default="")
    google_review_rating = Column(Float, nullable=True)
    submitted_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    submitted_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    store = relationship("Store", backref="submissions")
    submitter = relationship("User", foreign_keys=[submitted_by])

    __table_args__ = (
        UniqueConstraint("store_id", "date"),
        Index("ix_submissions_store_date", "store_id", "date"),
    )


# ── Leads ──────────────────────────────────────────────────────────
class Lead(Base):
    __tablename__ = "leads"
    id = Column(Integer, primary_key=True, autoincrement=True)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=False)
    source = Column(String(20), nullable=False, default="inbound")
    name = Column(String(100), nullable=False)
    phone = Column(String(20), default="")
    status = Column(String(20), default="warm")
    stage = Column(String(50), default="new")
    assigned_to = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_contacted_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    store = relationship("Store", backref="leads")
    assignee = relationship("User", foreign_keys=[assigned_to])


# ── Lead Activities ────────────────────────────────────────────────
class LeadActivity(Base):
    __tablename__ = "lead_activities"
    id = Column(Integer, primary_key=True, autoincrement=True)
    lead_id = Column(Integer, ForeignKey("leads.id", ondelete="CASCADE"), nullable=False)
    type = Column(String(20), nullable=False)
    outcome = Column(String(50), default="")
    notes = Column(Text, default="")
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    lead = relationship("Lead", backref="activities")
    creator = relationship("User", foreign_keys=[created_by])


# ── Lost Reasons ───────────────────────────────────────────────────
class LostReason(Base):
    __tablename__ = "lost_reasons"
    id = Column(Integer, primary_key=True, autoincrement=True)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=False)
    date = Column(Date, nullable=False)
    reason = Column(String(50), nullable=False)
    count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    store = relationship("Store", backref="lost_reasons")


# ── Campaigns ──────────────────────────────────────────────────────
class Campaign(Base):
    __tablename__ = "campaigns"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    channel = Column(String(50), default="")
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    budget = Column(Numeric(14, 2), default=0)
    status = Column(String(20), default="draft")
    success_rate = Column(Float, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ── Tasks ──────────────────────────────────────────────────────────
class Task(Base):
    __tablename__ = "tasks"
    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, default="")
    type = Column(String(20), default="task")
    assigned_to = Column(Integer, ForeignKey("users.id"), nullable=True)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=True)
    due_at = Column(DateTime, nullable=True)
    status = Column(String(20), default="pending")
    priority = Column(String(10), default="medium")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    assignee = relationship("User", foreign_keys=[assigned_to])
    store = relationship("Store", backref="tasks")


# ── KPI Weights ────────────────────────────────────────────────────
class KPIWeight(Base):
    __tablename__ = "kpi_weights"
    id = Column(Integer, primary_key=True, autoincrement=True)
    kpi_name = Column(String(100), unique=True, nullable=False)
    description = Column(String(200), default="")
    weight = Column(Numeric(4, 2), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ── Incentive Bands ────────────────────────────────────────────────
class IncentiveBand(Base):
    __tablename__ = "incentive_bands"
    id = Column(Integer, primary_key=True, autoincrement=True)
    band_name = Column(String(50), nullable=False)
    min_kpi_score = Column(Numeric(4, 2), nullable=False)
    multiplier = Column(Numeric(4, 2), nullable=False)
    label = Column(String(100), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ── Google Reviews ─────────────────────────────────────────────────
class GoogleReview(Base):
    __tablename__ = "google_reviews"
    id = Column(Integer, primary_key=True, autoincrement=True)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=False)
    date = Column(Date, nullable=False)
    rating = Column(Float, default=0)
    total_reviews = Column(Integer, default=0)
    new_reviews = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    store = relationship("Store", backref="google_reviews")


# ── Investments ────────────────────────────────────────────────────
class Investment(Base):
    __tablename__ = "investments"
    id = Column(Integer, primary_key=True, autoincrement=True)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=True)
    category = Column(String(50), nullable=False)
    description = Column(String(200), default="")
    amount = Column(Numeric(14, 2), nullable=False)
    date = Column(Date, nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    store = relationship("Store", backref="investments")
    creator = relationship("User", foreign_keys=[created_by])


# ── Sheet Sources ──────────────────────────────────────────────────
class SheetSource(Base):
    __tablename__ = "sheet_sources"
    id = Column(Integer, primary_key=True, autoincrement=True)
    label = Column(String(100), nullable=False)
    spreadsheet_id = Column(String(200), nullable=False)
    is_xlsx_upload = Column(Boolean, default=False)
    sync_interval_minutes = Column(Integer, default=5)
    is_enabled = Column(Boolean, default=True)
    tab_mappings = Column(JSON, default=dict)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ── Sheet Sync Log ─────────────────────────────────────────────────
class SheetSyncLog(Base):
    __tablename__ = "sheet_sync_log"
    id = Column(Integer, primary_key=True, autoincrement=True)
    sheet_source_id = Column(Integer, ForeignKey("sheet_sources.id", ondelete="CASCADE"), nullable=False)
    tab_name = Column(String(100), default="")
    last_synced_at = Column(DateTime, nullable=True)
    rows_synced = Column(Integer, default=0)
    status = Column(String(20), default="pending")
    error_message = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    source = relationship("SheetSource", backref="sync_logs")


# ── Audit Log ──────────────────────────────────────────────────────
class AuditLog(Base):
    __tablename__ = "audit_log"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String(50), nullable=False)
    resource = Column(String(50), nullable=False)
    resource_id = Column(Integer, nullable=True)
    before_json = Column(JSON, nullable=True)
    after_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", foreign_keys=[user_id])


# ── Settings ───────────────────────────────────────────────────────
class Setting(Base):
    __tablename__ = "settings"
    key = Column(String(100), primary_key=True)
    value = Column(Text, default="")
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ── CEO Dashboard: Marketing Metrics (per store per month) ──────────
class MarketingMetrics(Base):
    __tablename__ = "marketing_metrics"
    id = Column(Integer, primary_key=True, autoincrement=True)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=False)
    month = Column(String(7), nullable=False)  # "2026-06"
    ig_videos_posted = Column(Integer, nullable=True)
    ig_views = Column(Integer, nullable=True)
    ig_followers = Column(Integer, nullable=True)
    ig_new_followers = Column(Integer, nullable=True)
    ig_likes = Column(Integer, nullable=True)
    ig_comments = Column(Integer, nullable=True)
    ig_dms_received = Column(Integer, nullable=True)
    ig_manychat_handled = Column(Integer, nullable=True)
    ig_posts = Column(Integer, nullable=True)
    wa_walkins = Column(Integer, default=0)
    google_rating = Column(Float, nullable=True)
    google_new_reviews = Column(Integer, nullable=True)
    google_review_response = Column(String(20), default="")  # Yes/Partial/No
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    store = relationship("Store")


# ── CEO Dashboard: Store Staff / People ─────────────────────────────
class StoreStaff(Base):
    __tablename__ = "store_staff"
    id = Column(Integer, primary_key=True, autoincrement=True)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=False)
    month = Column(String(7), nullable=False)  # "2026-06"
    manager_name = Column(String(100), default="")
    staff_count = Column(Integer, default=0)
    total_headcount = Column(Integer, default=0)
    has_accommodation = Column(Boolean, default=False)
    resignation_risk = Column(Integer, default=0)
    training_active = Column(Boolean, default=False)
    notes = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    store = relationship("Store")


# ── CEO Dashboard: International Stores ─────────────────────────────
class InternationalStore(Base):
    __tablename__ = "international_stores"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    country = Column(String(20), nullable=False)  # UAE, Oman
    region = Column(String(20), nullable=False)    # AUH, DXB, AJM, OMN
    month = Column(String(7), nullable=False)      # "2026-06"
    target = Column(Numeric(14, 2), nullable=True)
    actual = Column(Numeric(14, 2), default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ── CEO Dashboard: Strategic Insights ───────────────────────────────
class StrategicInsight(Base):
    __tablename__ = "strategic_insights"
    id = Column(Integer, primary_key=True, autoincrement=True)
    month = Column(String(7), nullable=False)
    category = Column(String(20), nullable=False)  # critical, warning, good, info
    title = Column(String(200), nullable=False)
    description = Column(Text, default="")
    action_tag = Column(Text, default="")
    assigned_to = Column(Text, default="")
    section = Column(String(50), default="overview")  # overview, ops, tl, intl, marketing, reviews, actions
    priority = Column(String(20), default="high")      # critical, high, strategic
    deadline = Column(String(20), default="")
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("ix_insight_month_section", "month", "section"),
    )


# ── Daily Store Tracker (from xlsx) ───────────────────────────────
class DailyStoreTracker(Base):
    __tablename__ = "daily_store_tracker"
    id = Column(Integer, primary_key=True, autoincrement=True)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=False)
    date = Column(String(30), nullable=False)
    store_name = Column(String(100), nullable=False)
    country = Column(String(10), default="")
    store_type = Column(String(50), default="")
    daily_revenue = Column(Numeric(14, 2), default=0)
    monthly_target = Column(Numeric(14, 2), default=0)
    mtd_revenue = Column(Numeric(14, 2), default=0)
    units_sold = Column(Integer, default=0)
    care_plus_attached = Column(Integer, default=0)
    prebookings = Column(Integer, default=0)
    ig_videos_posted = Column(Integer, default=0)
    ig_views_target = Column(Numeric(14, 2), default=0)
    ig_views_achieved = Column(Numeric(14, 2), default=0)
    ig_views_achd_pct = Column(Float, default=0)
    ig_followers = Column(Integer, default=0)
    ig_new_followers = Column(Integer, default=0)
    ig_likes = Column(Integer, default=0)
    ig_comments = Column(Integer, default=0)
    ig_saves = Column(Integer, default=0)
    ig_shares = Column(Integer, default=0)
    ig_reposts = Column(Integer, default=0)
    ig_dms_received = Column(Integer, default=0)
    ig_manychat_handled = Column(Integer, default=0)
    ig_posts_published = Column(Integer, default=0)
    yt_views = Column(Integer, default=0)
    yt_likes = Column(Integer, default=0)
    yt_comments = Column(Integer, default=0)
    tt_views = Column(Integer, default=0)
    tt_likes = Column(Integer, default=0)
    tt_followers = Column(Integer, default=0)
    sc_views = Column(Integer, default=0)
    sc_shares = Column(Integer, default=0)
    wa_chats_received = Column(Integer, default=0)
    wa_walkins_booked = Column(Integer, default=0)
    google_rating = Column(Float, nullable=True)
    google_new_reviews = Column(Integer, default=0)
    google_review_response = Column(String(20), default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    store = relationship("Store")

    __table_args__ = (
        UniqueConstraint("store_id", "date"),
        Index("ix_tracker_store_date", "store_id", "date"),
    )


# ── Store Dashboard (from xlsx) ───────────────────────────────────
class StoreDashboardSnapshot(Base):
    __tablename__ = "store_dashboard_snapshots"
    id = Column(Integer, primary_key=True, autoincrement=True)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=False)
    snapshot_date = Column(String(30), nullable=False)
    store_name = Column(String(100), nullable=False)
    country = Column(String(10), default="")
    mtd_revenue = Column(Numeric(14, 2), default=0)
    monthly_target = Column(Numeric(14, 2), default=0)
    target_pct = Column(Float, default=0)
    care_plus_pct = Column(Float, default=0)
    total_views = Column(Integer, default=0)
    engagements = Column(Integer, default=0)
    eng_rate_pct = Column(Float, default=0)
    prebookings = Column(Integer, default=0)
    dms_received = Column(Integer, default=0)
    wa_response_pct = Column(Float, default=0)
    walkins_booked = Column(Integer, default=0)
    insta_followers = Column(Integer, default=0)
    follower_growth = Column(Integer, default=0)
    google_rating = Column(Float, nullable=True)
    new_reviews = Column(Integer, default=0)
    sales_status = Column(String(50), default="")
    marketing_status = Column(String(50), default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    store = relationship("Store")

    __table_args__ = (
        UniqueConstraint("store_id", "snapshot_date"),
    )


# ── AI Executive Summary ─────────────────────────────────────────
class AISummaryConfig(Base):
    __tablename__ = "ai_summary_config"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(50), unique=True, nullable=False, default="overview")
    system_prompt = Column(Text, default="")
    provider = Column(String(20), default="claude")
    model_name = Column(String(100), default="")
    is_active = Column(Boolean, default=True)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AISummaryRun(Base):
    __tablename__ = "ai_summary_run"
    id = Column(Integer, primary_key=True, autoincrement=True)
    config_id = Column(Integer, ForeignKey("ai_summary_config.id"), nullable=True)
    period = Column(String(7), nullable=False)  # "2026-08"
    input_fingerprint = Column(String(200), default="")
    status = Column(String(20), default="ok")  # ok, error, running
    response_json = Column(JSON, nullable=True)
    error_message = Column(Text, nullable=True)
    provider = Column(String(20), default="claude")
    model = Column(String(100), default="")
    input_tokens = Column(Integer, default=0)
    output_tokens = Column(Integer, default=0)
    cost_estimate = Column(Numeric(10, 6), default=0)
    generated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)

    config = relationship("AISummaryConfig")

    __table_args__ = (
        Index("ix_summary_run_period", "period"),
    )
