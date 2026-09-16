// ---------- Fond personnalisé ----------

function applyBackground() {
  const saved = localStorage.getItem('bgImage')
  const bgLayer = document.getElementById('bg-layer')
  if (saved && bgLayer) {
    bgLayer.style.backgroundImage = `url(${saved})`
  }
}
applyBackground()

// ---------- Sélecteur de pays ----------

const countrySelect = document.getElementById('country-code')
if (countrySelect) {
  countrySelect.innerHTML = COUNTRIES
    .map((c) => `<option value="${c.iso}" data-dial="${c.dial}">${c.flag} +${c.dial}</option>`)
    .join('')
}

// ---------- Validation + Check spam ----------

function getSelectedCountry() {
  const iso = countrySelect.value
  return COUNTRIES.find((c) => c.iso === iso)
}

function validateNumber(rawNumber, isoCountry) {
  if (!window.libphonenumber) return { valid: true } // fallback si le CDN n'a pas chargé
  try {
    const phoneNumber = libphonenumber.parsePhoneNumberFromString(rawNumber, isoCountry)
    if (!phoneNumber) return { valid: false, reason: 'Format de numéro invalide' }
    if (!phoneNumber.isValid()) return { valid: false, reason: 'Numéro invalide pour ce pays' }
    return { valid: true, e164: phoneNumber.number }
  } catch (err) {
    return { valid: false, reason: 'Format de numéro invalide' }
  }
}

async function checkNumber(number) {
  const res = await fetch('/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ number }),
  })
  return res.json()
}

const checkForm = document.getElementById('check-form')
const validationHint = document.getElementById('validation-hint')
const numberInput = document.getElementById('number-input')

if (numberInput) {
  numberInput.addEventListener('input', () => {
    const country = getSelectedCountry()
    const result = validateNumber(numberInput.value.trim(), country.iso)
    if (numberInput.value.trim() && !result.valid) {
      validationHint.textContent = `⚠ ${result.reason}`
      validationHint.style.color = '#c9807e'
    } else {
      validationHint.textContent = ''
    }
  })
}

if (checkForm) {
  checkForm.addEventListener('submit', async (e) => {
    e.preventDefault()
    const country = getSelectedCountry()
    const rawNumber = numberInput.value.trim()
    const resultEl = document.getElementById('result')
    const btn = e.target.querySelector('button[type="submit"]')

    const validation = validateNumber(rawNumber, country.iso)
    if (!validation.valid) {
      resultEl.className = 'show error'
      resultEl.textContent = `⚠ ${validation.reason}`
      return
    }

    const numberToSend = validation.e164 || `+${country.dial}${rawNumber}`

    btn.disabled = true
    const originalText = btn.textContent
    btn.textContent = 'Vérification...'
    resultEl.className = ''

    try {
      const result = await checkNumber(numberToSend)
      resultEl.classList.add('show')

      if (result.error) {
        resultEl.classList.add('error')
        resultEl.textContent = result.error
      } else if (result.banned) {
        resultEl.classList.add('banned')

        // Détermine le libellé d'état selon le type de ban renvoyé par l'API
        let statusLabel
        if (result.ban_type === 'hard_ban' || result.ban_type === 'perma_ban') {
          resultEl.classList.add('perma')
          statusLabel = 'Ban perma'
        } else if (result.ban_type === 'temp_ban') {
          statusLabel = '⏳ BANNI — Temporaire'
        } else if (result.mod_ban) {
          statusLabel = '⚠️ BANNI — Modération (souvent temporaire)'
        } else {
          statusLabel = '🩸 BANNI'
        }

        let text = statusLabel
        if (result.violation_label) text += `\nMotif : ${result.violation_label}`
        if (result.violation_category) text += `\nCatégorie : ${result.violation_category}`
        if (result.in_app_ban_appeal) text += '\n\nUn appel est possible depuis l\'application WhatsApp.'
        resultEl.textContent = text
      } else {
        resultEl.classList.add('clean')
        resultEl.textContent = '🕊️ PROPRE — ' + (result.message || 'Ce numéro n\'est pas signalé')
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

// ---------- Autofill depuis le presse-papier ----------

const autofillBtn = document.getElementById('autofill-btn')
if (autofillBtn) {
  autofillBtn.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText()
      const digitsOnly = text.replace(/[^\d+]/g, '')
      if (!digitsOnly) {
        validationHint.textContent = '⚠ Aucun numéro trouvé dans le presse-papier'
        validationHint.style.color = '#c9807e'
        return
      }
      numberInput.value = digitsOnly.replace(/^\+?\d{1,3}/, (m) => m.replace('+', ''))
      numberInput.dispatchEvent(new Event('input'))
    } catch (err) {
      validationHint.textContent = '⚠ Autorisez l\'accès au presse-papier pour utiliser Autofill'
      validationHint.style.color = '#c9807e'
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
