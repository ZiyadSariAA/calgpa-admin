const APP_ID = 'aSIiiNbqyhzLj87rbCtK'

/**
 * جلب الفرص الحقيقية من تطبيق عتبة (Glide)
 * يجلب بيانات برامج تطوير الخريجين والتدريب التعاوني
 */
export async function fetchOpportunities() {
  // 1) Get the dataSnapshot URL via POST
  const snapshotRes = await fetch(`/glide-api/api/container/playerFunctionCritical/getAppSnapshot`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appID: APP_ID }),
  })

  if (!snapshotRes.ok) {
    throw new Error(`فشل جلب بيانات التطبيق: ${snapshotRes.status}`)
  }

  const snapshotData = await snapshotRes.json()
  const dataUrl = snapshotData.dataSnapshot

  if (!dataUrl) {
    throw new Error('لم يتم العثور على رابط البيانات')
  }

  // 2) Fetch the data snapshot via proxy (rewrite GCS URL)
  const gcsPath = dataUrl.replace('https://storage.googleapis.com', '')
  const dataRes = await fetch(`/glide-data${gcsPath}`)

  if (!dataRes.ok) {
    throw new Error(`فشل جلب البيانات: ${dataRes.status}`)
  }

  const rawText = await dataRes.text()

  // Decode — could be JSON or base64-encoded JSON
  let parsed
  try {
    parsed = JSON.parse(rawText)
  } catch {
    // Use TextDecoder for proper UTF-8 Arabic support (atob only handles Latin1)
    const bytes = Uint8Array.from(atob(rawText), c => c.codePointAt(0))
    const decoded = new TextDecoder('utf-8').decode(bytes)
    parsed = JSON.parse(decoded)
  }

  const allOpportunities = []

  // 3) Map GDP table (List)
  const gdpRows = parsed.data?.List || []
  for (const row of gdpRows) {
    const d = row.data
    allOpportunities.push({
      title: d.Name || '',
      company: d.Company || '',
      specializations: d.Majors || '',
      link: d.Link || '',
      deadline: d.Dates || '',
      type: 'تطوير خريجين',
      status: d.Status || '',
      logo: d.Logo || '',
      dot: d.Dot || '',
      source: 'gdp',
    })
  }

  // 4) Map COOP table (Sheet2)
  const coopRows = parsed.data?.Sheet2 || []
  for (const row of coopRows) {
    const d = row.data
    allOpportunities.push({
      title: d.Company || '',
      company: d.Company || '',
      specializations: d.column5 || d.Majors || '',
      link: d.Link || '',
      deadline: typeof d.Date === 'object' ? (d.Date?.repr || d.Date?.value || '') : (d.Date || ''),
      type: 'تدريب تعاوني',
      status: d.Status || '',
      logo: d.Logo || '',
      city: d.City || '',
      notes: d.column7 || '',
      source: 'coop',
    })
  }

  return allOpportunities
}
