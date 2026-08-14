"""One-off script: overwrite each AISummaryConfig row's system_prompt with the
current section default so the distinct per-tab prompts take effect on existing
rows (get_or_create_config does not update existing configs)."""
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import AsyncSessionLocal
from app.models.models import AISummaryConfig
from app.services.ai_section_contexts import SECTION_DEFAULT_PROMPTS
from app.services.ai_summary_service import DEFAULT_SYSTEM_PROMPT

from sqlalchemy import select


async def main() -> None:
    async with AsyncSessionLocal() as db:
        rows = (await db.execute(select(AISummaryConfig))).scalars().all()
        if not rows:
            print("No AISummaryConfig rows found.")
            return
        for row in rows:
            default = SECTION_DEFAULT_PROMPTS.get(row.name, DEFAULT_SYSTEM_PROMPT)
            row.system_prompt = default
            print(f"  reset {row.name}: {len(default)} chars")
        await db.commit()
        print(f"Reset {len(rows)} config(s).")


if __name__ == "__main__":
    asyncio.run(main())