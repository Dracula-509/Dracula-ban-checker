// ---------- Fond personnalisé ----------

function applyBackground() {
  const saved = localStorage.getItem('bgImage')
  const bgLayer = document.getElementById('bg-layer')
  if (saved && bgLayer) {
    bgLayer.style.backgroundImage = `url(${saved})`
  }
}
applyBackground()

// ---------- Indicatif pays (saisie libre) ----------

// Recherche du pays par indicatif : on prend le plus long dial qui matche
// (ex: 1 = US/CA par défaut, mais 1809/1849/1829 = République Dominicaine)
function findCountryByDial(dial) {
  const clean = String(dial || '').replace(/\D/g, '')
  if (!clean) return null
  const matches = COUNTRIES.filter((c) => clean.startsWith(c.dial))
  if (!matches.length) return null
  // le match le plus précis = l'indicatif le plus long
  return matches.sort((a, b) => b.dial.length - a.dial.length)[0]
}

const dialInput = document.getElementById('dial-input')
const dialFlag = document.getElementById('dial-flag')
const dialBox = document.getElementById('dial-box')

function getSelectedCountry() {
  const dial = dialInput.value.trim()
  const country = findCountryByDial(dial)
  return country || { iso: undefined, dial, flag: '🏳️', name: null }
}

function refreshDialFlag() {
  const dial = dialInput.value.trim()
  if (!dial) {
    dialFlag.textContent = '🏳️'
    dialBox.classList.remove('unknown')
    validationHint.textContent = ''
    return
  }
  const country = findCountryByDial(dial)
  if (country) {
    dialFlag.textContent = country.flag
    dialBox.classList.remove('unknown')
    validationHint.textContent = ''
  } else {
    dialFlag.textContent = '❓'
    dialBox.classList.add('unknown')
    validationHint.textContent = `⚠ Indicatif +${dial} inconnu — aucun pays ne correspond, le numéro sera envoyé tel quel`
    validationHint.style.color = '#c9807e'
  }
}

if (dialInput) {
  dialInput.value = '49'
  dialInput.addEventListener('input', () => {
    dialInput.value = dialInput.value.replace(/\D/g, '')
    refreshDialFlag()
    if (numberInput && numberInput.value.trim()) numberInput.dispatchEvent(new Event('input'))
  })
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

function validateNumber(rawNumber, isoCountry) {
  const digits = String(rawNumber || '').replace(/\D/g, '')
  // Format basique seulement : entre 4 et 14 chiffres après l'indicatif.
  // On ne vérifie plus le plan de numérotation exact du pays (longueur pile,
  // préfixes d'opérateur, etc.) — un numéro qui n'existe pas mais dont le
  // format (indicatif + chiffres) est respecté doit passer.
  if (!digits) return { valid: false, reason: 'Numéro vide' }
  if (digits.length < 4 || digits.length > 14) {
    return { valid: false, reason: 'Longueur de numéro invalide' }
  }
  return { valid: true }
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

// Fuseau horaire principal par indicatif (une valeur représentative par pays ;
// les pays à fuseaux multiples, ex US/Russie/Canada, utilisent leur zone la plus peuplée)
const DIAL_TIMEZONE = {
  '1': 'America/New_York', '7': 'Europe/Moscow', '20': 'Africa/Cairo', '27': 'Africa/Johannesburg',
  '30': 'Europe/Athens', '31': 'Europe/Amsterdam', '32': 'Europe/Brussels', '33': 'Europe/Paris',
  '34': 'Europe/Madrid', '36': 'Europe/Budapest', '39': 'Europe/Rome', '40': 'Europe/Bucharest',
  '41': 'Europe/Zurich', '43': 'Europe/Vienna', '44': 'Europe/London', '45': 'Europe/Copenhagen',
  '46': 'Europe/Stockholm', '47': 'Europe/Oslo', '48': 'Europe/Warsaw', '49': 'Europe/Berlin',
  '51': 'America/Lima', '52': 'America/Mexico_City', '53': 'America/Havana', '54': 'America/Argentina/Buenos_Aires',
  '55': 'America/Sao_Paulo', '56': 'America/Santiago', '57': 'America/Bogota', '58': 'America/Caracas',
  '60': 'Asia/Kuala_Lumpur', '61': 'Australia/Sydney', '62': 'Asia/Jakarta', '63': 'Asia/Manila',
  '64': 'Pacific/Auckland', '65': 'Asia/Singapore', '66': 'Asia/Bangkok', '81': 'Asia/Tokyo',
  '82': 'Asia/Seoul', '84': 'Asia/Ho_Chi_Minh', '86': 'Asia/Shanghai', '90': 'Europe/Istanbul',
  '91': 'Asia/Kolkata', '92': 'Asia/Karachi', '93': 'Asia/Kabul', '94': 'Asia/Colombo',
  '95': 'Asia/Yangon', '98': 'Asia/Tehran', '211': 'Africa/Juba', '212': 'Africa/Casablanca',
  '213': 'Africa/Algiers', '216': 'Africa/Tunis', '218': 'Africa/Tripoli', '220': 'Africa/Banjul',
  '221': 'Africa/Dakar', '222': 'Africa/Nouakchott', '223': 'Africa/Bamako', '224': 'Africa/Conakry',
  '225': 'Africa/Abidjan', '226': 'Africa/Ouagadougou', '227': 'Africa/Niamey', '228': 'Africa/Lome',
  '229': 'Africa/Porto-Novo', '230': 'Indian/Mauritius', '233': 'Africa/Accra', '234': 'Africa/Lagos',
  '236': 'Africa/Bangui', '237': 'Africa/Douala', '241': 'Africa/Libreville', '242': 'Africa/Brazzaville',
  '243': 'Africa/Kinshasa', '244': 'Africa/Luanda', '250': 'Africa/Kigali', '251': 'Africa/Addis_Ababa',
  '252': 'Africa/Mogadishu', '253': 'Africa/Djibouti', '254': 'Africa/Nairobi', '255': 'Africa/Dar_es_Salaam',
  '256': 'Africa/Kampala', '260': 'Africa/Lusaka', '261': 'Indian/Antananarivo', '263': 'Africa/Harare',
  '351': 'Europe/Lisbon', '352': 'Europe/Luxembourg', '353': 'Europe/Dublin', '354': 'Atlantic/Reykjavik',
  '355': 'Europe/Tirane', '356': 'Europe/Malta', '357': 'Asia/Nicosia', '358': 'Europe/Helsinki',
  '359': 'Europe/Sofia', '370': 'Europe/Vilnius', '371': 'Europe/Riga', '372': 'Europe/Tallinn',
  '373': 'Europe/Chisinau', '374': 'Asia/Yerevan', '375': 'Europe/Minsk', '376': 'Europe/Andorra',
  '377': 'Europe/Monaco', '378': 'Europe/San_Marino', '380': 'Europe/Kyiv', '385': 'Europe/Zagreb',
  '386': 'Europe/Ljubljana', '387': 'Europe/Sarajevo', '420': 'Europe/Prague', '421': 'Europe/Bratislava',
  '501': 'America/Belize', '502': 'America/Guatemala', '503': 'America/El_Salvador', '504': 'America/Tegucigalpa',
  '505': 'America/Managua', '506': 'America/Costa_Rica', '507': 'America/Panama', '509': 'America/Port-au-Prince',
  '591': 'America/La_Paz', '592': 'America/Guyana', '593': 'America/Guayaquil', '595': 'America/Asuncion',
  '597': 'America/Paramaribo', '598': 'America/Montevideo', '852': 'Asia/Hong_Kong', '855': 'Asia/Phnom_Penh',
  '856': 'Asia/Vientiane', '880': 'Asia/Dhaka', '960': 'Indian/Maldives', '961': 'Asia/Beirut',
  '962': 'Asia/Amman', '963': 'Asia/Damascus', '964': 'Asia/Baghdad', '965': 'Asia/Kuwait',
  '966': 'Asia/Riyadh', '967': 'Asia/Aden', '968': 'Asia/Muscat', '970': 'Asia/Gaza',
  '971': 'Asia/Dubai', '972': 'Asia/Jerusalem', '973': 'Asia/Bahrain', '974': 'Asia/Qatar',
  '975': 'Asia/Thimphu', '976': 'Asia/Ulaanbaatar', '977': 'Asia/Kathmandu', '994': 'Asia/Baku',
  '995': 'Asia/Tbilisi', '996': 'Asia/Bishkek', '998': 'Asia/Tashkent',
  '298': 'Atlantic/Faroe', '299': 'America/Nuuk', '590': 'America/Guadeloupe',
  '596': 'America/Martinique', '594': 'America/Cayenne', '687': 'Pacific/Noumea',
  '689': 'Pacific/Tahiti', '852': 'Asia/Hong_Kong', '853': 'Asia/Macau', '886': 'Asia/Taipei',
  '350': 'Europe/Gibraltar',
}

// Heure actuelle dans le pays de la personne, à partir de l'indicatif
function getLocalTimeForDial(dial) {
  const tz = DIAL_TIMEZONE[String(dial || '').replace(/\D/g, '')]
  if (!tz) return null
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      timeZone: tz,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date())
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
    } else if (!country.iso && dialInput.value.trim()) {
      // indicatif inconnu : le message d'avertissement reste affiché (posé par refreshDialFlag)
      refreshDialFlag()
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

    const dialForSend = country.dial || dialInput.value.trim()
    const numberToSend = validation.e164 || `+${dialForSend}${rawNumber}`

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

        const localTime = getLocalTimeForDial(dialForSend)

        let rows = ''
        rows += detailRow('Phone', numberToSend)
        if (localTime) rows += detailRow('Heure locale', `${country.flag || ''} ${localTime}`.trim())
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
        const localTime = getLocalTimeForDial(dialForSend)
        let rows = ''
        rows += detailRow('Phone', numberToSend)
        if (localTime) rows += detailRow('Heure locale', `${country.flag || ''} ${localTime}`.trim())
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

      const hadPlus = digitsOnly.startsWith('+')
      const justDigits = digitsOnly.replace(/^\+/, '')

      if (hadPlus) {
        // Le numéro collé contient bien un indicatif (ex: +509...) :
        // on détecte le pays automatiquement et on sépare indicatif / numéro local
        let matched = null
        for (let len = Math.min(4, justDigits.length); len >= 1; len--) {
          const candidateDial = justDigits.slice(0, len)
          const country = COUNTRIES.find((c) => c.dial === candidateDial)
          if (country) { matched = country; break }
        }
        if (matched) {
          dialInput.value = matched.dial
          numberInput.value = justDigits.slice(matched.dial.length)
        } else {
          // Indicatif présent mais inconnu de notre liste : on le met quand même,
          // on ne bloque pas ("si ça passe ça passe")
          const guessedDialLen = justDigits.length > 10 ? justDigits.length - 10 : 1
          dialInput.value = justDigits.slice(0, guessedDialLen)
          numberInput.value = justDigits.slice(guessedDialLen)
        }
      } else {
        // Pas de "+" dans le texte collé : on ne touche pas à l'indicatif déjà choisi,
        // on colle juste le numéro local
        numberInput.value = justDigits
      }

      refreshDialFlag()
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
