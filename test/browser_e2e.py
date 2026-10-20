"""Browser end-to-end run with 3 players. Saves screenshots to test/shots/.
Run: TEST_HOOKS=1 PORT=3920 node server.js &  then  python3 test/browser_e2e.py
"""
import os, sys, time
from playwright.sync_api import sync_playwright

BASE = os.environ.get('BASE', 'http://localhost:3920')
OUT = os.path.join(os.path.dirname(__file__), 'shots')
os.makedirs(OUT, exist_ok=True)
errors = []

def shot(page, name):
    page.screenshot(path=os.path.join(OUT, name + '.png'))
    print('  shot', name)

def watch(page, label):
    page.on('console', lambda m: m.type == 'error' and errors.append(f'{label}: {m.text}'))
    page.on('pageerror', lambda e: errors.append(f'{label}: PAGEERROR {e}'))

with sync_playwright() as p:
    b = p.chromium.launch()
    host = b.new_context(viewport={'width': 1366, 'height': 860}).new_page(); watch(host, 'host')
    mob = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, device_scale_factor=2).new_page(); watch(mob, 'mobile')
    p2 = b.new_context(viewport={'width': 1280, 'height': 800}).new_page(); watch(p2, 'p2')

    # Home + create
    host.goto(BASE); host.wait_for_timeout(700); shot(host, '01_home')
    host.click('[data-mode=create]'); host.fill('#c-name', 'דנה'); host.click('[data-dur="12"]')
    shot(host, '02_create')
    host.click('#f-create button[type=submit]'); host.wait_for_selector('#lb-code')
    code = host.inner_text('#lb-code').strip(); print('  room', code)

    # Joins via QR link
    mob.goto(f'{BASE}/?room={code}'); mob.wait_for_selector('#j-name'); mob.fill('#j-name', 'יוסי'); mob.click('#f-join button[type=submit]')
    p2.goto(f'{BASE}/?room={code}'); p2.wait_for_selector('#j-name'); p2.fill('#j-name', 'BadName'); p2.click('#f-join button[type=submit]')
    host.wait_for_function('document.querySelectorAll(".prow").length === 3'); host.wait_for_timeout(400)
    shot(host, '03_lobby_host'); shot(mob, '04_lobby_mobile')

    # Report a name -> forced rename
    host.click('.prow:has-text("BadName") [data-act=report]'); p2.wait_for_selector('#ov-rename'); shot(p2, '05_rename')
    p2.fill('#rn-in', 'BadName'); p2.click('#f-rename button'); p2.wait_for_timeout(300)
    assert 'דווח' in p2.inner_text('#rn-err') or 'reported' in p2.inner_text('#rn-err')
    p2.fill('#rn-in', 'Noa'); p2.click('#f-rename button'); p2.wait_for_selector('#ov-rename', state='detached')
    host.click('.prow:has-text("יוסי") [data-act=promote]'); host.wait_for_timeout(300)

    # Start
    host.click('#lb-start')
    for pg in (host, mob, p2): pg.wait_for_selector('.desktop', timeout=5000)
    host.wait_for_timeout(500); shot(host, '06_boot')
    for pg in (host, mob, p2): pg.wait_for_selector('.ov.boot', state='detached', timeout=6000)
    shot(host, '07_desktop')

    # Regular call on mobile
    mob.wait_for_selector('#c-answer', timeout=12000); shot(mob, '08_mobile_ringing')
    mob.click('#c-answer'); mob.wait_for_timeout(300)
    if mob.query_selector('.opt'):
        mob.wait_for_timeout(1200); shot(mob, '09_mobile_call'); mob.click('.opt >> nth=0'); mob.wait_for_selector('.result', timeout=4000); shot(mob, '10_mobile_result')
    else:
        shot(mob, '09_mobile_special')

    # Boost on host
    host.evaluate("Net.request('test:force', {charId: 'whale_mom'})"); host.wait_for_selector('#c-answer'); host.click('#c-answer')
    host.wait_for_selector('#c-collect', timeout=8000); shot(host, '11_boost'); host.click('#c-collect'); host.wait_for_selector('.delta.plus'); host.wait_for_timeout(500); shot(host, '12_boost_done')

    # George on p2
    p2.evaluate("Net.request('test:force', {charId: 'george'})"); p2.wait_for_selector('#c-answer'); shot(p2, '13_george_ring')
    p2.click('#c-answer'); p2.wait_for_timeout(6000); shot(p2, '14_george_talk')

    # Chat meanwhile (help + lb) on mobile
    mob.click('.task[data-task=chat]'); mob.wait_for_selector('#dchat')
    mob.click('[data-ch=global]'); mob.fill('#c-input', 'שלום מוקדנים!'); mob.press('#c-input', 'Enter'); mob.wait_for_timeout(500)
    p2.evaluate("window.__medios.openWin('chat')")
    p2.click('[data-ch=help]'); p2.fill('#c-input', 'איך עונים לשיחה? ומה זה ג׳ורג׳?'); p2.press('#c-input', 'Enter')
    p2.wait_for_selector('.msg.bot', timeout=5000); p2.wait_for_timeout(300); shot(p2, '15_help_bot')
    p2.click('[data-ch=lb]'); p2.click('[data-preset=top3]'); p2.wait_for_timeout(700); p2.click('[data-preset=myrank]'); p2.wait_for_timeout(800); shot(p2, '16_leaderboards')

    host.click('.dicon[data-app=chat]'); host.wait_for_selector('#dchat'); host.click('[data-ch=help]'); host.wait_for_selector('[data-tk]'); shot(host, '17_admin_queue')
    host.click('[data-tk]'); host.wait_for_selector('[data-claim]'); host.click('[data-claim]'); host.wait_for_timeout(400)
    host.fill('#c-input', 'היי נועה, אני המנהלת — פתחי את אפליקציית מד"א לעזרה.'); host.press('#c-input', 'Enter'); host.wait_for_timeout(500)
    shot(host, '18_admin_thread')
    # mobile (manager) sees it is claimed
    mob.click('[data-ch=help]'); mob.wait_for_selector('[data-tk]'); shot(mob, '19_mobile_admin_queue')
    # members panel w/ moderation
    host.click('[data-members]'); host.wait_for_selector('#dmembers'); shot(host, '20_members')

    # Back to George: wait out 30s
    p2.click('.dicon[data-app=calls]')
    p2.wait_for_selector('#g-yes', timeout=35000); shot(p2, '21_george_question')
    p2.click('#g-yes'); p2.wait_for_timeout(1500); shot(p2, '22_launch')
    p2.wait_for_selector('.planet-stage', timeout=8000); p2.wait_for_selector('#c-collect', timeout=8000); shot(p2, '23_planet')
    p2.click('#c-collect'); p2.wait_for_timeout(700); shot(p2, '24_planet_done')

    # Other apps
    host.click('.dicon[data-app=mda]'); host.wait_for_timeout(400); shot(host, '25_mda')
    host.click('.dicon[data-app=settings]'); host.wait_for_timeout(300); shot(host, '26_settings')
    mob.click('.task[data-task=calls]'); mob.wait_for_timeout(300); shot(mob, '27b_mobile_calls_dock')
    p2.click('[data-tab=index]'); p2.wait_for_timeout(300); shot(p2, '27_index')
    p2.click('#tb-lang'); p2.wait_for_timeout(600); shot(p2, '28_english')

    # Mute + end
    host.click('[data-mute]'); host.wait_for_timeout(500)
    host.evaluate("Net.request('game:end', {})"); host.wait_for_selector('#ov-over', timeout=5000); host.wait_for_timeout(400); shot(host, '29_gameover')
    mob.wait_for_selector('#ov-over'); shot(mob, '30_gameover_mobile')
    host.click('[data-lobby]'); host.wait_for_selector('#lb-code', timeout=5000); mob.wait_for_selector('#lb-code', timeout=5000)
    print('  back in lobby OK')
    b.close()

print('\nConsole errors:', len(errors))
for e in errors: print('  ', e)
sys.exit(1 if errors else 0)
