// ---------- Fond personnalisé ----------

function applyBackground() {
  const saved = localStorage.getItem('bgImage')
  const bgLayer = document.getElementById('bg-layer')
  if (saved && bgLayer) {
    bgLayer.style.backgroundImage = `url(${saved})`
  }
}
applyBackground()

// ---------- Check spam ----------

async function checkNumber(number) {
  const res = await fetch('/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ number }),
  })
  return res.json()
}

const checkForm = document.getElementById('check-form')
if (checkForm) {
  checkForm.addEventListener('submit', async (e) => {
    e.preventDefault()
    const number = document.getElementById('number-input').value.trim()
    const resultEl = document.getElementById('result')
    const btn = e.target.querySelector('button')

    btn.disabled = true
    const originalText = btn.textContent
    btn.textContent = 'Vérification...'
    resultEl.className = ''

    try {
      const result = await checkNumber(number)
      resultEl.classList.add('show')

      if (result.error) {
        resultEl.classList.add('error')
        resultEl.textContent = result.error
      } else if (result.banned) {
        resultEl.classList.add('banned')
        resultEl.textContent = `🩸 Ce numéro est banni${result.reason ? ' — ' + result.reason : ''}`
      } else {
        resultEl.classList.add('clean')
        resultEl.textContent = '🕊️ Ce numéro n\'est pas signalé'
      }

      if (localStorage.getItem('vibrate') !== 'off' && navigator.vibrate) {
        navigator.vibrate(result.banned ? [80, 40, 80] : 40)
      }
    } catch (err) {
      resultEl.classList.add('show', 'error')
      resultEl.textContent = 'Connexion au serveur impossible. Réessayez.'
    } finally {
      btn.disabled = false
      btn.textContent = originalText
    }
  })
}

// ---------- Menu dropdown ----------

const menuBtn = document.getElementById('menu-btn')
const dropdown = document.getElementById('dropdown')

if (menuBtn) {
  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    dropdown.classList.toggle('open')
  })

  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target) && e.target !== menuBtn) {
      dropdown.classList.remove('open')
    }
  })
}

// ---------- Modales ----------

document.querySelectorAll('[data-modal]').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.getElementById(btn.dataset.modal).classList.add('open')
    dropdown.classList.remove('open')
  })
})

document.querySelectorAll('.modal-backdrop').forEach((backdrop) => {
  const closeBtn = backdrop.querySelector('.close-modal')
  if (closeBtn) closeBtn.addEventListener('click', () => backdrop.classList.remove('open'))
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) backdrop.classList.remove('open')
  })
})

// ---------- Actions du menu ----------

const historyBtn = document.getElementById('history-btn')
if (historyBtn) {
  historyBtn.addEventListener('click', () => {
    alert('Historique des vérifications — à venir.')
  })
}

const checkUpdatesBtn = document.getElementById('check-updates-btn')
if (checkUpdatesBtn) {
  checkUpdatesBtn.addEventListener('click', () => {
    alert('Vous utilisez la dernière version : v1.0')
    dropdown.classList.remove('open')
  })
}

const shareBtn = document.getElementById('share-btn')
if (shareBtn) {
  shareBtn.addEventListener('click', async () => {
    dropdown.classList.remove('open')
    const shareData = { title: 'Dracula Check Ban', text: 'Vérifiez si un numéro WhatsApp est signalé spam.', url: window.location.origin }
    if (navigator.share) {
      try { await navigator.share(shareData) } catch (e) {}
    } else {
      await navigator.clipboard.writeText(shareData.url)
      alert('Lien copié dans le presse-papiers.')
    }
  })
}

const telegramBtn = document.getElementById('telegram-btn')
if (telegramBtn) {
  telegramBtn.addEventListener('click', () => {
    window.open('https://t.me/', '_blank')
    dropdown.classList.remove('open')
  })
}

const apiBtn = document.getElementById('api-btn')
if (apiBtn) {
  apiBtn.addEventListener('click', () => {
    alert('Documentation de l\'API BanCheck : https://baron0.com/api/v2/check\n(Nécessite une clé — voir avec l\'administrateur du site.)')
    dropdown.classList.remove('open')
  })
}

// ---------- Pick background image ----------

const pickBgBtn = document.getElementById('pick-bg-btn')
const bgModal = document.getElementById('bg-modal')
const bgFileInput = document.getElementById('bg-file-input')
const bgPreviewBox = document.getElementById('bg-preview-box')

if (pickBgBtn) {
  pickBgBtn.addEventListener('click', () => {
    dropdown.classList.remove('open')
    const saved = localStorage.getItem('bgImage')
    if (saved) bgPreviewBox.style.backgroundImage = `url(${saved})`
    bgModal.classList.add('open')
  })

  bgFileInput.addEventListener('change', () => {
    const file = bgFileInput.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target.result
      bgPreviewBox.style.backgroundImage = `url(${dataUrl})`
      localStorage.setItem('bgImage', dataUrl)
      document.getElementById('bg-layer').style.backgroundImage = `url(${dataUrl})`
    }
    reader.readAsDataURL(file)
  })
}

// ---------- Settings ----------

const vibrateToggle = document.getElementById('vibrate-toggle')
if (vibrateToggle) {
  vibrateToggle.checked = localStorage.getItem('vibrate') !== 'off'
  vibrateToggle.addEventListener('change', () => {
    localStorage.setItem('vibrate', vibrateToggle.checked ? 'on' : 'off')
  })
}
