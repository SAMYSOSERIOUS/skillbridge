"""Source registry for the local real-data edition.

Every file is real, public, and pinned to an exact git commit so the
download is reproducible byte for byte. See docs/04_DATASETS.md ("Local
edition") for licenses and provenance. Only raw.githubusercontent.com is
required, which also works in restricted networks.
"""

from dataclasses import dataclass

RAW_HOST = "https://raw.githubusercontent.com"

# Pinned commits (verified 2026-09-17)
SHA_GPTS = "0471612fef3cc22b74fb884d27bff9dbd3770582"  # openai/GPTs-are-GPTs
SHA_AIOE = "adca5fc2cd0e9a659ff05278b7fa7a53f4f324c1"  # AIOE-Data/AIOE
SHA_MSFT = "c94a07c52fb1d88ca5d221388f06d10e1bd6d2fe"  # microsoft/working-with-ai


@dataclass(frozen=True)
class Source:
    key: str  # data/raw/<key>/<filename>
    repo: str
    sha: str
    path: str  # path inside the repo (URL-encoded when fetched)
    filename: str  # local filename
    min_rows: int  # validation: fail ingest if fewer data rows than this
    description: str

    @property
    def url(self) -> str:
        return f"{RAW_HOST}/{self.repo}/{self.sha}/{self.path.replace(' ', '%20')}"


SOURCES: list[Source] = [
    Source(
        key="openai",
        repo="openai/GPTs-are-GPTs",
        sha=SHA_GPTS,
        path="data/occ_level.csv",
        filename="occ_level.csv",
        min_rows=900,
        description="OpenAI/Eloundou et al. occupation-level LLM exposure (MIT license)",
    ),
    Source(
        key="oews",
        repo="openai/GPTs-are-GPTs",
        sha=SHA_GPTS,
        path="data/national_May2021_dl.csv",
        filename="national_May2021_dl.csv",
        min_rows=1300,
        description="BLS OEWS national wages, May 2021 release (US Gov public data)",
    ),
    Source(
        key="aioe",
        repo="AIOE-Data/AIOE",
        sha=SHA_AIOE,
        path="Language Modeling AIOE and AIIE.xlsx",
        filename="aioe.xlsx",
        min_rows=700,
        description="Felten/Raj/Seamans AI Occupational Exposure index (attribution)",
    ),
    Source(
        key="msft",
        repo="microsoft/working-with-ai",
        sha=SHA_MSFT,
        path="ai_applicability_scores.csv",
        filename="ai_applicability_scores.csv",
        min_rows=700,
        description="Microsoft Research AI applicability scores (CC BY 4.0)",
    ),
    Source(
        key="onet_tasks",
        repo="openai/GPTs-are-GPTs",
        sha=SHA_GPTS,
        path="data/full_onet_data.tsv",
        filename="full_onet_data.tsv",
        min_rows=18000,
        description="O*NET task statements per occupation (O*NET via MIT repo)",
    ),
]
