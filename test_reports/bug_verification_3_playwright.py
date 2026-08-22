# Focused browser verification for user-reported Rekapin candidate input/import bug.
# This script is executed through the MCP browser automation tool inside an async context with `page` available.

import time

async def run(page):

    page_errors = []
    console_errors = []
    api_responses = []

    page.on("pageerror", lambda exc: page_errors.append(str(exc)))
    page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
    page.on("response", lambda response: api_responses.append(f"{response.status} {response.url}") if "/api/candidates" in response.url else None)

    suffix = str(int(time.time()))
    single_name = f"QA Bug3 Single {suffix}"
    single_email = f"qa.single.{suffix}@example.com"
    bulk_name_1 = f"QA Bulk3 Andi {suffix}"
    bulk_email_1 = f"qa.andi.{suffix}@example.com"
    bulk_name_2 = f"QA Bulk3 Budi {suffix}"
    bulk_email_2 = f"qa.budi.{suffix}@example.com"
    blacklist_reason = f"Tidak hadir interview tanpa kabar {suffix}"

    try:
        await page.set_viewport_size({"width": 1920, "height": 1080})
        await page.goto("https://recruit-master-12.preview.emergentagent.com/login")
        await page.evaluate("localStorage.removeItem('hr_recruit_token')")
        await page.reload()
        await page.wait_for_selector('[data-testid="login-email-input"]', timeout=15000)
        print("Login page loaded")

        await page.locator('[data-testid="login-email-input"]').fill("wardah.nabilah97@gmail.com")
        await page.locator('[data-testid="login-password-input"]').fill("admin123")
        await page.locator('[data-testid="login-submit-button"]').click()
        await page.wait_for_url("**/dashboard", timeout=20000)
        await page.wait_for_selector('[data-testid="btn-add-candidate"]', timeout=20000)
        print("Dashboard loaded cleanly after login")

        # Remove old QA rows from earlier attempts before testing.
        precleanup = await page.evaluate("""async () => {
            const token = localStorage.getItem('hr_recruit_token');
            const res = await fetch('/api/candidates', {headers: {Authorization: `Bearer ${token}`}});
            const rows = await res.json();
            const targets = rows.filter(r => (r.nama || '').startsWith('QA Bug3 ') || (r.nama || '').startsWith('QA Bulk3 '));
            for (const r of targets) {
              await fetch(`/api/candidates/${r.id}`, {method: 'DELETE', headers: {Authorization: `Bearer ${token}`}});
            }
            return targets.map(r => r.nama);
        }""")
        print(f"Pre-cleaned QA rows: {precleanup}")
        await page.reload()
        await page.wait_for_selector('[data-testid="btn-add-candidate"]', timeout=15000)

        # Add single candidate with email, date, interview status, and blacklist reason.
        await page.locator('[data-testid="btn-add-candidate"]').click()
        await page.wait_for_selector('[data-testid="input-tanggal-interview"]', timeout=15000)
        date_type = await page.locator('[data-testid="input-tanggal-interview"]').evaluate("el => el.type")
        if date_type != "date":
            raise Exception(f"Tanggal Interview input type is {date_type}, expected date")
        print("Tanggal Interview is native input type=date")

        await page.locator('[data-testid="input-nama"]').fill(single_name)
        await page.locator('[data-testid="input-email"]').fill(single_email)
        await page.locator('[data-testid="input-no-hp"]').fill("0811999888")
        await page.locator('[data-testid="input-usia"]').fill("27")
        await page.locator('[data-testid="input-apply"]').fill("Kasir QA")
        await page.locator('[data-testid="input-pic"]').fill("QA-HR")
        await page.locator('[data-testid="input-alamat"]').fill("Jl QA Bug 3")

        await page.locator('[data-testid="select-status-interview"]').click(force=True)
        await page.wait_for_timeout(200)
        await page.get_by_role("option", name="Terjadwal", exact=True).click(force=True)
        await page.wait_for_timeout(200)

        date_input = page.locator('[data-testid="input-tanggal-interview"]')
        await date_input.click(force=True)
        await date_input.fill("2026-03-15")
        date_value = await date_input.input_value()
        if date_value != "2026-03-15":
            raise Exception(f"Tanggal Interview did not accept value; got {date_value}")
        print("Tanggal Interview accepted 2026-03-15")

        await page.locator('[data-testid="select-status-blacklist"]').click(force=True)
        await page.wait_for_timeout(200)
        await page.get_by_role("option", name="Ya - Pelanggaran", exact=True).click(force=True)
        await page.wait_for_selector('[data-testid="input-alasan-blacklist"]', timeout=10000)
        await page.locator('[data-testid="input-alasan-blacklist"]').fill(blacklist_reason)
        print("Alasan Blacklist textarea appears after Ya status and accepts text")

        await page.locator('[data-testid="btn-save-candidate"]').click()
        await page.wait_for_selector('[data-testid="input-nama"]', state="detached", timeout=20000)
        await page.wait_for_timeout(1000)
        await page.locator('[data-testid="search-input"]').fill(single_name)
        single_row = page.locator("tr", has_text=single_name).first
        await single_row.wait_for(state="visible", timeout=15000)
        single_row_text = await single_row.text_content()
        if single_email not in single_row_text:
            raise Exception("Saved candidate email is not visible in Master Data row")
        print("Email field saved and appears in Master Data Email column")

        # Re-open edit and verify date persistence.
        await single_row.locator('[data-testid^="row-actions-"]').click(force=True)
        await page.wait_for_timeout(200)
        await page.locator('[role="menuitem"]', has_text="Edit").click(force=True)
        await page.wait_for_selector('[data-testid="input-tanggal-interview"]', timeout=15000)
        persisted_date = await page.locator('[data-testid="input-tanggal-interview"]').input_value()
        if persisted_date != "2026-03-15":
            raise Exception(f"Edit dialog did not persist date; got {persisted_date}")
        print("Edit dialog re-open shows persisted date 2026-03-15")
        await page.locator('[data-testid="btn-cancel-candidate"]').click(force=True)
        await page.wait_for_selector('[data-testid="input-nama"]', state="detached", timeout=10000)

        # Interview tab should show the date.
        await page.locator('[data-testid="tab-interview"]').click(force=True)
        await page.wait_for_timeout(700)
        interview_row = page.locator("tr", has_text=single_name).first
        await interview_row.wait_for(state="visible", timeout=15000)
        interview_text = await interview_row.text_content()
        if "2026-03-15" not in interview_text:
            raise Exception("Interview tab does not show saved date")
        print("Interview tab shows saved date")

        # Blacklist tab should show full reason under status pill.
        await page.locator('[data-testid="tab-blacklist"]').click(force=True)
        await page.wait_for_timeout(700)
        blacklist_row = page.locator("tr", has_text=single_name).first
        await blacklist_row.wait_for(state="visible", timeout=15000)
        blacklist_text = await blacklist_row.text_content()
        if blacklist_reason not in blacklist_text:
            raise Exception("Blacklist tab does not show alasan blacklist text")
        print("Blacklist tab shows blacklist reason text")

        # Bulk import from tab-separated Google Sheets-style paste.
        await page.locator('[data-testid="tab-master"]').click(force=True)
        await page.locator('[data-testid="search-input"]').fill("")
        await page.wait_for_timeout(500)
        await page.locator('[data-testid="btn-bulk-import"]').click(force=True)
        await page.wait_for_selector('[data-testid="bulk-paste-input"]', timeout=15000)
        bulk_text = f"{bulk_name_1}\t{bulk_email_1}\t0811\t23\tKasir\tJakarta\tJl A\tHR-1\t-\n{bulk_name_2}\t{bulk_email_2}\t0812\t25\tSales\tSurabaya\tJl B\tHR-2\t-"
        await page.locator('[data-testid="bulk-paste-input"]').fill(bulk_text)
        await page.wait_for_timeout(500)
        preview_text = await page.locator('[data-testid="bulk-preview-count"]').text_content()
        if "2" not in preview_text:
            raise Exception(f"Bulk preview count is wrong: {preview_text}")
        print(f"Bulk preview count displayed: {preview_text}")
        await page.locator('[data-testid="btn-confirm-bulk"]').click(force=True)
        await page.wait_for_selector('[data-testid="bulk-paste-input"]', state="detached", timeout=20000)
        await page.wait_for_timeout(1500)
        await page.locator('[data-testid="search-input"]').fill("QA Bulk3")
        await page.locator("tr", has_text=bulk_name_1).first.wait_for(state="visible", timeout=15000)
        await page.locator("tr", has_text=bulk_name_2).first.wait_for(state="visible", timeout=15000)
        bulk_table_text = await page.locator("table").first.text_content()
        if bulk_email_1 not in bulk_table_text or bulk_email_2 not in bulk_table_text:
            raise Exception("Bulk imported emails are not visible in Master Data")
        print("Bulk import inserted both pasted candidates and emails appear in Master Data")

        # API truth check for persistence before cleanup.
        api_check = await page.evaluate("""async (names) => {
            const token = localStorage.getItem('hr_recruit_token');
            const res = await fetch('/api/candidates', {headers: {Authorization: `Bearer ${token}`}});
            const rows = await res.json();
            return names.map(n => rows.find(r => r.nama === n) || null);
        }""", [single_name, bulk_name_1, bulk_name_2])
        if not all(api_check):
            raise Exception(f"API persistence check missing rows: {api_check}")
        if api_check[0].get("tanggal_interview") != "2026-03-15" or api_check[0].get("email") != single_email or api_check[0].get("alasan_blacklist") != blacklist_reason:
            raise Exception(f"API persistence fields mismatch: {api_check[0]}")
        print("API persistence verified for email, tanggal_interview, bulk rows, and alasan_blacklist")

        # Required error selector sweep.
        error_text = await page.evaluate("""() => {
            const errorElements = Array.from(document.querySelectorAll('.error, [class*="error"], [id*="error"]'));
            return errorElements.map(el => el.textContent).join(", ");
        }""")
        if error_text:
            print(f"Found error message: {error_text}")
        else:
            print("No error messages found on the page")

        # Cleanup created QA rows.
        cleanup = await page.evaluate("""async (names) => {
            const token = localStorage.getItem('hr_recruit_token');
            const res = await fetch('/api/candidates', {headers: {Authorization: `Bearer ${token}`}});
            const rows = await res.json();
            const targets = rows.filter(r => names.includes(r.nama));
            for (const r of targets) {
              await fetch(`/api/candidates/${r.id}`, {method: 'DELETE', headers: {Authorization: `Bearer ${token}`}});
            }
            return targets.map(r => r.nama);
        }""", [single_name, bulk_name_1, bulk_name_2])
        print(f"Cleaned created QA rows: {cleanup}")

        critical_runtime_errors = [e for e in page_errors + console_errors if "BulkImportDialog" in e or "ReferenceError" in e]
        if critical_runtime_errors:
            raise Exception(f"Runtime errors detected: {critical_runtime_errors}")
        print(f"Relevant API responses observed: {api_responses}")
        print("FOCUSED BUG VERIFICATION PASSED")

    except Exception as e:
        print(f"FOCUSED BUG VERIFICATION FAILED: {e}")
        print(f"Page errors: {page_errors}")
        print(f"Console errors: {console_errors}")
        print(f"Relevant API responses observed: {api_responses}")
        raise
