Project Specification: Multi-Mode & Voice-Enabled Expense Tracker

1. Executive Summary

A web-based personal expense tracker tailored for modern payment habits (specifically accounting for India's payment ecosystem alongside traditional methods). Users can log expenses across Cash, Card, and UPI, handle Split-Mode Payments (e.g., paying a single bill using multiple payment methods), and log cash expenses effortlessly via Voice-to-Text (Audio Transcription).

2. Target Audience & Context

Primary Users: Individuals managing daily personal finances who frequently switch between digital (UPI, Cards) and physical (Cash) transactions.

Key Value Proposition: Eliminates the friction of logging loose cash transactions through voice input while accurately tracking complex multi-method (split) payments.

3. Core Features & Functional Requirements

3.1 Authentication & User Management

User Login / Sign-up: Secure authentication (Email/Password and Google OAuth).

Session Persistence: Users remain logged in across sessions; all expense data is strictly isolated per user account.

3.2 Expense Logging (Core Engine)

Standard Fields:

Total Amount (Currency: ₹ INR default, configurable)

Merchant / Title / Description

Category (Food & Dining, Groceries, Transport, Utilities, Shopping, Entertainment, Other)

Date & Time (Defaults to current timestamp, editable)

Notes / Tags (Optional)

Payment Modes:

UPI: Option to tag UPI app/handle (e.g., GPay, PhonePe, Paytm, Cred).

Card: Credit or Debit card, optional last 4 digits or bank name.

Cash: Physical currency tracking.

Split-Mode Payments (Multi-Tender):

Toggleable "Split Payment" mode on the Add Expense form.

Allows breaking a single transaction into multiple payment legs (e.g., Total ₹1,200 = ₹500 Cash + ₹700 UPI).

Validation Rule: The sum of all split legs must strictly equal the Total Amount before saving.

3.3 Voice-to-Expense (Audio Transcription for Cash & Quick Logs)

Voice Recorder UI: Prominent microphone button in the header/FAB and inside the "Add Expense" modal.

Audio Capture: Uses browser MediaRecorder API to capture short audio clips (e.g., "Paid 150 rupees cash for auto rickshaw" or "Spent 400 on groceries, 200 cash and 200 UPI").

AI Transcription & Entity Extraction:

Transcribes audio to text.

Automatically parses natural language into structured JSON fields (amount, category, payment_mode, merchant/description, and splits if mentioned).

Populates the expense form for user review/confirmation before final save.

3.4 Dashboard & Analytics

Summary Cards: Total Spend (This Month), Cash Spend, UPI Spend, Card Spend.

Visualizations:

Breakdown by Payment Mode (Pie/Donut chart — accurately accounting for split-mode legs).

Breakdown by Category (Bar chart).

Transaction Ledger:

Searchable, filterable list of transactions (Filter by Date Range, Category, Payment Mode, or "Split Payments Only").

Expandable rows for Split-Mode transactions to show the breakdown of payment methods used.

4. Data Schema (Conceptual)

Users

id (UUID, Primary Key)

email (String)

name (String)

created_at (Timestamp)

Expenses

id (UUID, Primary Key)

user_id (UUID, Foreign Key -> Users)

title (String)

total_amount (Decimal)

category (String)

transaction_date (Timestamp)

is_split (Boolean)

raw_voice_transcript (Text, Nullable)

created_at (Timestamp)

Payment_Splits (Tracks both single and split payments uniformly)

id (UUID, Primary Key)

expense_id (UUID, Foreign Key -> Expenses)

payment_method (Enum: CASH, UPI, CARD)

amount (Decimal)

method_details (String, Nullable — e.g., "HDFC Credit", "GPay")

5. Technical Stack & Workflow

Prototyping (Stitch): Generate responsive UI layouts, auth screens, dashboard, and interactive modals.

Export & Full-Stack Integration (Google AI Studio):

Connect Gemini Multimodal API (gemini-2.5-flash) to handle direct audio-to-JSON extraction (combining transcription and structured parsing in a single API call).

Wire up state management and persistent storage (Firebase / Supabase or LocalStorage fallback for testing).