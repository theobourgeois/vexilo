name: Generate Flag of the Day

on:
  schedule:
    # Run every day at 9:00 AM UTC
    - cron: '0 9 * * *'
  push:
    branches:
      - main
  workflow_dispatch: # allows manual trigger

jobs:
  run-script:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Run shell script
        run:  "chmod +x ./scripts/fotd.sh && ./scripts/fotd.sh"
