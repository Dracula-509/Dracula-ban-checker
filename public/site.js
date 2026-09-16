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

// ---------- Popup résultat ----------

const resultBackdrop = document.getElementById('result-backdrop')
const resultCard = document.getElementById('result-card')
const resultNumberEl = document.getElementById('result-number')
const resultTitleEl = document.getElementById('result-title')
const resultDetailsEl = document.getElementById('result-details')
const resultNoteEl = document.getElementById('result-note')
const resultCopyBtn = document.getElementById('result-copy-btn')
const resultCloseBtn = document.getElementById('result-close-btn')

function detailRow(key, valueHtml) {
  return `<div class="detail-row"><span class="detail-key">${key}</span><span class="detail-val mono">${valueHtml}</span></div>`
}

function getCustomTitle(kind) {
  // kind: 'banned' | 'clean'
  const stored = localStorage.getItem(kind === 'banned' ? 'bannedText' : 'cleanText')
  if (stored && stored.trim()) return stored.trim()
  return kind === 'banned' ? 'This number is banned' : 'This number is active'
}

function openResultPopup({ variant, numberDisplay, title, icon, detailsHtml, note }) {
  resultCard.className = `result-card ${variant}`
  resultNumberEl.textContent = numberDisplay
  resultTitleEl.innerHTML = `${icon ? icon + ' ' : ''}${title}`
  resultDetailsEl.innerHTML = detailsHtml || ''
  resultDetailsEl.style.display = detailsHtml ? '' : 'none'
  if (note) {
    resultNoteEl.textContent = note
    resultNoteEl.style.display = ''
  } else {
    resultNoteEl.style.display = 'none'
  }
  resultBackdrop.classList.add('open')
}

if (resultCloseBtn) resultCloseBtn.addEventListener('click', () => resultBackdrop.classList.remove('open'))
if (resultBackdrop) {
  resultBackdrop.addEventListener('click', (e) => {
    if (e.target === resultBackdrop) resultBackdrop.classList.remove('open')
  })
}
if (resultCopyBtn) {
  resultCopyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(resultNumberEl.textContent.trim())
      resultCopyBtn.textContent = 'Copied ✓'
      setTimeout(() => { resultCopyBtn.textContent = 'Copy' }, 1200)
    } catch (err) {}
  })
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

async function fetchAppealStatus(number) {
  try {
    const res = await fetch(`/api/appeal-status?phone=${encodeURIComponent(number)}`)
    if (!res.ok) return null
    return res.json()
  } catch (err) {
    return null
  }
}

// Formate un timestamp ISO 8601 (UTC) en heure locale lisible
function formatTimestamp(iso) {
  if (!iso) return null
  const date = new Date(iso)
  if (isNaN(date.getTime())) return null
  return date.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
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
    const btn = e.target.querySelector('button[type="submit"]')

    const validation = validateNumber(rawNumber, country.iso)
    if (!validation.valid) {
      validationHint.textContent = `⚠ ${validation.reason}`
      validationHint.style.color = '#c9807e'
      return
    }

    const numberToSend = validation.e164 || `+${country.dial}${rawNumber}`

    btn.disabled = true
    const originalText = btn.textContent
    btn.textContent = 'Vérification...'

    try {
      const result = await checkNumber(numberToSend)

      if (result.error) {
        openResultPopup({
          variant: 'error',
          numberDisplay: numberToSend,
          title: result.error,
          icon: '⚠',
        })
      } else if (result.banned) {
        // On récupère le détail exact (perma ou pas, heures) via appeal-status,
        // seule source fiable pour is_perma — ban_type seul peut induire en erreur
        const appeal = await fetchAppealStatus(numberToSend)
        const isPerma = appeal ? !!appeal.is_perma : (result.ban_type === 'perma_ban')

        const customTitle = getCustomTitle('banned')
        const variant = isPerma ? 'banned perma' : 'banned'
        const icon = isPerma ? '🩸' : '⏳'

        let rows = ''
        rows += detailRow('Phone', numberToSend)
        rows += detailRow('Ban type', `<span class="badge danger">${isPerma ? 'perma_ban' : (result.ban_type || 'temp_ban')}</span>`)
        if (result.violation_label) rows += detailRow('Violation', result.violation_label)
        if (result.violation_category) rows += detailRow('Category', `<span class="badge neutral">${result.violation_category}</span>`)
        rows += detailRow('Appeal', result.in_app_ban_appeal
          ? '<span class="badge success">● Available</span>'
          : '<span class="badge neutral">Unavailable</span>')
        if (typeof result.is_eu === 'boolean') rows += detailRow('EU', result.is_eu ? 'Yes' : 'No')
        if (appeal) {
          const banTime = formatTimestamp(appeal.ban_time)
          const appealTime = formatTimestamp(appeal.appeal_creation_time)
          if (banTime) rows += detailRow('Banned at', banTime)
          if (appealTime) rows += detailRow('Appeal filed', appealTime)
        }
        rows += detailRow('Status', isPerma
          ? '<span class="badge danger">Perma — Definitive</span>'
          : '<span class="badge danger">Temporary</span>')

        openResultPopup({
          variant,
          numberDisplay: numberToSend,
          title: customTitle,
          icon,
          detailsHtml: rows,
          note: result.in_app_ban_appeal ? "Un appel est possible depuis l'application WhatsApp." : null,
        })
      } else {
        const customTitle = getCustomTitle('clean')
        let rows = ''
        rows += detailRow('Phone', numberToSend)
        rows += detailRow('Status', '<span class="badge success">● Active on WhatsApp</span>')

        openResultPopup({
          variant: 'clean',
          numberDisplay: numberToSend,
          title: customTitle,
          icon: '🕊️',
          detailsHtml: rows,
          note: result.message || null,
        })
      }

      if (localStorage.getItem('vibrate') !== 'off' && navigator.vibrate) {
        navigator.vibrate(result.banned ? [80, 40, 80] : 40)
      }
    } catch (err) {
      openResultPopup({
        variant: 'error',
        numberDisplay: numberToSend,
        title: 'Connexion au serveur impossible. Réessayez.',
        icon: '⚠',
      })
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

const bannedTextInput = document.getElementById('banned-text-input')
if (bannedTextInput) {
  bannedTextInput.value = localStorage.getItem('bannedText') || ''
  bannedTextInput.addEventListener('input', () => {
    localStorage.setItem('bannedText', bannedTextInput.value)
  })
}

const cleanTextInput = document.getElementById('clean-text-input')
if (cleanTextInput) {
  cleanTextInput.value = localStorage.getItem('cleanText') || ''
  cleanTextInput.addEventListener('input', () => {
    localStorage.setItem('cleanText', cleanTextInput.value)
  })
}
