'use client'

import { useState, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Upload, Download, FileSpreadsheet, CheckCircle2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

export type ImportResult = { success: number; failed: number; errors?: string[] }

interface ExcelImportProps {
  open: boolean
  onClose: () => void
  onImport: (rows: Record<string, string>[]) => Promise<ImportResult>
  templateHeaders: string[]
  sampleRows: Record<string, string>[]
  templateName: string
  onSuccess?: () => void
}

export function ExcelImport({ open, onClose, onImport, templateHeaders, sampleRows, templateName, onSuccess }: ExcelImportProps) {
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [isParsing, setIsParsing] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const downloadTemplate = async () => {
    const XLSX = await import('xlsx')
    const header = templateHeaders
    const sample = sampleRows.map((r) => header.map((h) => r[h] ?? ''))
    const ws = XLSX.utils.aoa_to_sheet([header, ...sample])
    ws['!cols'] = header.map(() => ({ wch: 20 }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Data')
    XLSX.writeFile(wb, `${templateName.toLowerCase().replace(/\s+/g, '-')}-import-template.xlsx`)
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsParsing(true)
    const reader = new FileReader()
    reader.onload = async (evt) => {
      try {
        const XLSX = await import('xlsx')
        const wb = XLSX.read(evt.target?.result as string, { type: 'binary' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const data = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' })
        if (data.length === 0) { toast.error('No data rows found in file'); setIsParsing(false); return }
        setRows(data)
        setResult(null)
      } catch {
        toast.error('Failed to parse file — ensure it is a valid .xlsx or .csv')
      }
      setIsParsing(false)
    }
    reader.readAsBinaryString(file)
  }

  const handleImport = async () => {
    setIsImporting(true)
    try {
      const res = await onImport(rows)
      setResult(res)
      if (res.success > 0) {
        toast.success(`${res.success} record${res.success > 1 ? 's' : ''} imported successfully`)
        onSuccess?.()
      }
      if (res.failed > 0) toast.error(`${res.failed} row${res.failed > 1 ? 's' : ''} failed`)
    } catch {
      toast.error('Import failed — check your data and try again')
    }
    setIsImporting(false)
  }

  const reset = () => {
    setRows([])
    setResult(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const previewHeaders = rows.length > 0 ? Object.keys(rows[0]) : []

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose() } }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-green-600" />
            Import {templateName} from Excel
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Step 1 — template */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start justify-between gap-4">
            <div>
              <p className="font-semibold text-blue-900 text-sm">Step 1 — Download the template</p>
              <p className="text-xs text-blue-700 mt-1">Use the provided template with exact column headers. Sample data is included.</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {templateHeaders.map((h) => (
                  <span key={h} className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded font-mono">{h}</span>
                ))}
              </div>
            </div>
            <Button variant="outline" size="sm" className="shrink-0 border-blue-300 text-blue-700 hover:bg-blue-100" onClick={downloadTemplate}>
              <Download className="h-4 w-4 mr-1" />Download Template
            </Button>
          </div>

          {/* Step 2 — upload */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-5 text-center space-y-2">
            <p className="font-semibold text-sm text-gray-700">Step 2 — Upload your filled Excel file</p>
            <p className="text-xs text-gray-500">Accepts .xlsx, .xls, .csv</p>
            <Input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="max-w-xs mx-auto cursor-pointer" />
            {isParsing && <p className="text-xs text-gray-500">Parsing file…</p>}
          </div>

          {/* Preview */}
          {rows.length > 0 && !result && (
            <div>
              <p className="text-sm font-semibold mb-2 text-gray-700">
                Preview — <span className="text-green-700">{rows.length} rows ready to import</span>
              </p>
              <div className="overflow-x-auto rounded-md border max-h-52">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>{previewHeaders.map((h) => <th key={h} className="px-2 py-1.5 text-left font-medium border-b whitespace-nowrap">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 6).map((row, i) => (
                      <tr key={i} className="border-b even:bg-gray-50">
                        {previewHeaders.map((h) => <td key={h} className="px-2 py-1.5 text-gray-600 whitespace-nowrap max-w-32 truncate">{row[h]}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length > 6 && <p className="text-xs text-gray-400 mt-1">Showing 6 of {rows.length} rows</p>}
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="space-y-3">
              <div className="flex gap-3 flex-wrap">
                {result.success > 0 && (
                  <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-2.5">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span className="font-semibold text-green-800">{result.success} imported</span>
                  </div>
                )}
                {result.failed > 0 && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
                    <AlertCircle className="h-5 w-5 text-red-600" />
                    <span className="font-semibold text-red-800">{result.failed} failed</span>
                  </div>
                )}
              </div>
              {result.errors && result.errors.length > 0 && (
                <div className="bg-red-50 border border-red-100 rounded p-3 text-xs text-red-700 max-h-36 overflow-y-auto space-y-1">
                  {result.errors.map((e, i) => <p key={i}>• {e}</p>)}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={() => { reset(); onClose() }}>Close</Button>
          {result && <Button variant="outline" onClick={reset}>Import Another File</Button>}
          {rows.length > 0 && !result && (
            <Button onClick={handleImport} disabled={isImporting} className="bg-green-600 hover:bg-green-700 text-white">
              <Upload className="h-4 w-4 mr-1" />
              {isImporting ? 'Importing…' : `Import ${rows.length} Row${rows.length > 1 ? 's' : ''}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
