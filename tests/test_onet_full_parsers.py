"""Parser unit tests for the full-O*NET ingestion (Fix 1/2).

The fixtures below are TEST FIXTURES ONLY - tiny, schema-identical stand-ins
so the parsers are verified before the first real download runs in CI. They
never enter data/ and are clearly not statistics.
"""

import io

import openpyxl
import pytest
from skillbridge.ingest.onet_full import parse_bls_education, read_onet_table

ONET_SKILLS_TSV = (
    "O*NET-SOC Code\tTitle\tElement ID\tElement Name\tScale ID\tScale Name\t"
    "Data Value\tN\tStandard Error\tLower CI Bound\tUpper CI Bound\t"
    "Recommend Suppress\tNot Relevant\tDate\tDomain Source\n"
    "11-1011.00\tChief Executives\t2.A.1.a\tReading Comprehension\tIM\tImportance\t"
    "4.12\t26\t0.13\t3.9\t4.4\tN\t\t08/2025\tAnalyst\n"
    "11-1011.00\tChief Executives\t2.A.1.a\tReading Comprehension\tLV\tLevel\t"
    "4.75\t26\t0.2\t4.3\t5.1\tN\tN\t08/2025\tAnalyst\n"
)


def test_read_onet_table_columns_and_values():
    df = read_onet_table(ONET_SKILLS_TSV.encode())
    expected = ["O*NET-SOC Code", "Title", "Element ID", "Element Name", "Scale ID"]
    assert list(df.columns)[:5] == expected
    assert df.iloc[0]["Scale ID"] == "IM"
    assert df.iloc[1]["Data Value"] == "4.75"


def _edu_workbook(header_offset: int = 2) -> bytes:
    wb = openpyxl.Workbook()
    ws = wb.active
    for _ in range(header_offset):
        ws.append(["Table 5.4 Education and training assignments", None, None, None])
    ws.append(
        [
            "2023 National Employment Matrix title",
            "2023 National Employment Matrix code",
            "Typical entry-level education",
            "Work experience in a related occupation",
            "Typical on-the-job training",
        ]
    )
    rows = [
        ("Chief executives", "11-1011", "Bachelor's degree", "5 years or more", "None"),
        ("Tellers", "43-3071", "High school diploma or equivalent", "None", "Short-term OJT"),
    ] * 200  # parser requires a plausibly full table
    for r in rows:
        ws.append(list(r))
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def test_parse_bls_education_normalizes():
    df = parse_bls_education(_edu_workbook())
    assert list(df.columns) == [
        "soc_code",
        "typical_education",
        "work_experience",
        "on_the_job_training",
    ]
    teller = df[df.soc_code == "43-3071"].iloc[0]
    assert teller.typical_education.startswith("High school")
    assert (df.soc_code.str.match(r"^\d{2}-\d{4}$")).all()


def test_parse_bls_education_rejects_wrong_workbook():
    wb = openpyxl.Workbook()
    wb.active.append(["nothing", "relevant", "here"])
    buf = io.BytesIO()
    wb.save(buf)
    with pytest.raises(ValueError):
        parse_bls_education(buf.getvalue())
