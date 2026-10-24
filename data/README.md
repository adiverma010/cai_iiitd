# Synthetic Sanocare data

These files were supplied for the IIIT-Delhi hackathon and are described by
the supplied dataset README as synthetic, containing no real patients or
caregivers, and free to use, modify, and redistribute for the event.

- `src/carecompass/data/caregivers.csv` is the synthetic roster used by the
  local matcher and packaged with the Python application.
- `../tests/fixtures/triage_dataset.jsonl` contains the 340 labelled contract
  examples used for reproducible conformance checks and exploratory metrics.
- `../tests/fixtures/multi_turn_examples.jsonl` contains two conversation
  examples used to check follow-up handling.

The labels and examples are not clinical ground truth and must not be used to
make real medical decisions. The source flat CSV is omitted because it
duplicates the JSONL examples.
