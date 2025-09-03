## Scrubby — CSV to SQL Table Generator (Desktop)

Turn CSV files into clean SQL quickly. Scrubby helps you inspect and clean columns, then generates `CREATE TABLE` and `INSERT` statements for PostgreSQL, MySQL, SQLite, and SQL Server. Runs entirely on your computer.

### Downloads - !!! CURRENTLY DISBLED !!! - See: Building From Source 

- **Windows**: download the latest Installer (`...-Windows-<version>-Setup.exe`) from this repository’s Releases page.
- **macOS**: download the `.dmg` Installer.
- **Linux**: download the `.AppImage` file, make it executable, and run it.

If you don’t see installers yet, you can still build from source (see below).

### Quick Start

1) Open Scrubby.
2) Choose a CSV file or paste CSV text.
3) Click "Parse CSV" to preview your data.
4) (Optional) Configure each column: types, cleaning rules, split/merge, missing-value handling, duplicate-key detection.
5) Select your SQL dialect and click "Generate SQL".
6) Copy the output (`CREATE TABLE` and `INSERT`) and run it in your database.

### Key Features

- **Multi‑dialect SQL**: PostgreSQL, MySQL, SQLite, SQL Server.
- **Type inference**: auto-suggests sensible column types from sample data.
- **Column cleaning**:
  - **Trim** whitespace; **normalize quotes/dashes**.
  - **Case transform** (none, lower, upper, title).
  - **Auto numeric**: convert strings like `$1,200.50` or `12%` into clean numbers.
  - **Strip non‑alphanumeric** for IDs/codes.
  - **Extract references**: remove markers like `[3]`, `†`, `*` into a separate "refs" column.
- **Find & replace**: simple or regex rules, applied in order.
- **Split** a column by delimiters into parts; optionally keep the original.
- **Merge** multiple columns into one with a chosen delimiter.
- **Missing values**: keep nulls, set a default, drop rows, or impute (mean/median/mode/custom).
- **Duplicate detection**: flag likely duplicates by selecting key columns.

### IMAGES

## Import your CSV, select your SQL dialect

[![sqrubby0.png](https://i.postimg.cc/mkz9H94h/sqrubby0.png)](https://postimg.cc/2LY3pVVf)

## Select options to scrub your data
[![sqrubby2.png](https://i.postimg.cc/cCpnMJ1h/sqrubby2.png)](https://postimg.cc/p5BrPRF5)

## See the preview of your data table before migrating your data

[![sqrubby1.png](https://i.postimg.cc/qvdKNg5M/sqrubby1.png)](https://postimg.cc/F7DzqFv2)

## Generate your SQL code!

[![sqrubby3.png](https://i.postimg.cc/HsM5Wb3h/sqrubby3.png)](https://postimg.cc/RNMqX6k7)


### Privacy

- Scrubby processes your CSV entirely **on-device**. No data leaves your computer.

### Requirements

- Windows 10/11 (x64), macOS 12+ (Intel/Apple Silicon), or a recent Linux (x64).
- Node.JS 18+ 
  - Win: https://nodejs.org/dist/latest/
  - For Linux, simply install the dependencies
- A modern database client to run the generated SQL.

### Troubleshooting

- **No SQL generated**: make sure you’ve parsed a CSV and then clicked "Generate SQL".
- **Weird characters**: enable "Normalize Quotes/Dashes" and/or "Strip Non‑Alnum" in column settings.
- **Wrong numeric formats**: enable "Auto Numeric" for those columns.
- **Dates not detected**: verify your dates look like `YYYY-MM-DD` or use a custom SQL type.
- **Too many types**: toggle "Show all datatypes" and set `n` where shown (e.g., `varchar(n)`, `float(n)`).

### Building From Source (REQUIRED)

If you prefer to build locally:

1) Install Node.js 18+.
2) Clone this repository and install dependencies:
   - `npm install`
3) Create installers:
   - `npm run build`
4) Find the platform-specific output in the `release/<version>/` directory.

### Uninstall

- Use your OS’s standard app uninstall flow. On Windows, use "Add or remove programs"; on macOS, move the app to Trash; on Linux, delete the AppImage file.

### Acknowledgments

- Built with React, Vite, Electron, and PapaParse.
