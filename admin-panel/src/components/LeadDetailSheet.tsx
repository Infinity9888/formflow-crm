import { useState, useEffect } from "react"
import { doc, updateDoc, deleteDoc, onSnapshot } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useTranslation } from "react-i18next"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Button, buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  Trash2,
  Save,
  Globe,
  Copy,
  Check,
  Phone,
  Mail,
  Send,
  User,
  Calendar,
  ExternalLink,
  MessageCircle,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface Lead {
  id: string
  status: "new" | "in_progress" | "completed" | "rejected"
  createdAt: string
  formData: Record<string, string>
  clientId: string
  source?: string
  notes?: string
}

interface LeadDetailSheetProps {
  lead: Lead | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted: () => void
}

export function LeadDetailSheet({ lead, open, onOpenChange, onDeleted }: LeadDetailSheetProps) {
  const { t } = useTranslation()
  const [notes, setNotes] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const statusConfig = {
    new: { label: t("status.new"), icon: AlertCircle, color: "text-blue-500 hover:text-blue-600", bg: "bg-blue-500/10", activeBg: "bg-blue-500 text-white" },
    in_progress: { label: t("status.in_progress"), icon: Clock, color: "text-amber-500 hover:text-amber-600", bg: "bg-amber-500/10", activeBg: "bg-amber-500 text-white" },
    completed: { label: t("status.completed"), icon: CheckCircle2, color: "text-emerald-500 hover:text-emerald-600", bg: "bg-emerald-500/10", activeBg: "bg-emerald-500 text-white" },
    rejected: { label: t("status.rejected"), icon: XCircle, color: "text-rose-500 hover:text-rose-600", bg: "bg-rose-500/10", activeBg: "bg-rose-500 text-white" },
  } as const

  useEffect(() => {
    if (!lead) return
    // Listen for real-time notes updates
    const unsubscribe = onSnapshot(doc(db, "leads", lead.id), (snap) => {
      if (snap.exists()) {
        setNotes(snap.data().notes || "")
      }
    })
    return () => unsubscribe()
  }, [lead?.id])

  const handleStatusChange = async (newStatus: Lead["status"]) => {
    if (!lead) return
    try {
      await updateDoc(doc(db, "leads", lead.id), { status: newStatus })
    } catch (error) {
      console.error("Error updating status:", error)
    }
  }

  const handleSaveNotes = async () => {
    if (!lead) return
    setIsSaving(true)
    try {
      await updateDoc(doc(db, "leads", lead.id), { notes })
    } catch (error) {
      console.error("Error saving notes:", error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!lead) return
    setIsDeleting(true)
    try {
      await deleteDoc(doc(db, "leads", lead.id))
      setShowDeleteDialog(false)
      onOpenChange(false)
      onDeleted()
    } catch (error) {
      console.error("Error deleting lead:", error)
    } finally {
      setIsDeleting(false)
    }
  }

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 1500)
  }

  if (!lead) return null

  // Extract contact credentials for quick actions
  const getContacts = () => {
    let phone = ""
    let email = ""
    let telegram = ""
    let instagram = ""
    let name = ""

    Object.entries(lead.formData).forEach(([key, val]) => {
      const v = String(val).trim()
      const k = key.toLowerCase()

      if ((k.includes("phone") || k.includes("тел") || k.includes("номер") || /^\+?[0-9\s\-()]{7,18}$/.test(v)) && !phone) {
        phone = v
      } else if ((k.includes("email") || k.includes("mail") || k.includes("почт") || k.includes("пошт") || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) && !email) {
        email = v
      } else if (k.includes("name") || k.includes("имя") || k.includes("імя") || k.includes("ім'я")) {
        name = v
      } else if (k.includes("telegram") || k.includes("tg") || k.includes("тг")) {
        telegram = v.replace(/^@/, "").replace("https://t.me/", "")
      } else if (k.includes("instagram") || k.includes("insta") || k.includes("инст")) {
        instagram = v.replace(/^@/, "").replace("https://instagram.com/", "")
      }
    })

    // If name not set, use first entry name if it exists
    if (!name) {
      const firstVal = Object.values(lead.formData)[0]
      if (firstVal && isNaN(Number(firstVal)) && !firstVal.includes("@")) {
        name = firstVal
      }
    }

    return { name, phone, email, telegram, instagram }
  }

  const contacts = getContacts()
  const hasContacts = contacts.phone || contacts.email || contacts.telegram || contacts.instagram

  const statusKey = lead.status as keyof typeof statusConfig
  const statusInfo = statusConfig[statusKey] || statusConfig.new
  const StatusIcon = statusInfo.icon

  // Initials for avatar
  const initials = contacts.name
    ? contacts.name.split(" ").slice(0, 2).map(n => n[0]).join("").toUpperCase()
    : "L"

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto border-l bg-background/95 backdrop-blur-md">
          {/* Header Customer Card */}
          <div className="flex items-start gap-4 pb-6 mt-4 border-b">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary to-primary/60 text-xl font-bold text-white shadow-md">
              {initials}
            </div>
            <div className="space-y-1 min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold truncate max-w-[220px]">
                  {contacts.name || t("detail.title")}
                </h3>
                <Badge variant="outline" className={`${statusInfo.color} ${statusInfo.bg} border-0 font-medium`}>
                  <StatusIcon className="mr-1 h-3.5 w-3.5" />
                  {statusInfo.label}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Calendar className="h-3 w-3" />
                {lead.createdAt}
              </p>
              {lead.source && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Globe className="h-3 w-3 text-blue-500/80" />
                  {lead.source}
                </p>
              )}
            </div>
          </div>

          {/* Quick Connect Actions */}
          {hasContacts && (
            <div className="py-5 border-b space-y-2.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {t("detail.quick_connect")}
              </p>
              <div className="flex flex-wrap gap-2">
                {contacts.phone && (
                  <>
                    <a
                      href={`https://wa.me/${contacts.phone.replace(/[^0-9]/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        buttonVariants({ variant: "outline", size: "sm" }),
                        "rounded-xl border hover:bg-green-500/10 hover:text-green-600 dark:hover:text-green-400 hover:border-green-500/30 transition-all duration-200"
                      )}
                    >
                      <MessageCircle className="mr-1.5 h-4 w-4 text-emerald-500" />
                      WhatsApp
                    </a>
                    <a
                      href={`tel:${contacts.phone}`}
                      className={cn(
                        buttonVariants({ variant: "outline", size: "sm" }),
                        "rounded-xl border hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-500/30 transition-all duration-200"
                      )}
                    >
                      <Phone className="mr-1.5 h-4 w-4 text-blue-500" />
                      {contacts.phone}
                    </a>
                  </>
                )}
                {contacts.telegram && (
                  <a
                    href={`https://t.me/${contacts.telegram}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                      "rounded-xl border hover:bg-sky-500/10 hover:text-sky-600 dark:hover:text-sky-400 hover:border-sky-500/30 transition-all duration-200"
                    )}
                  >
                    <Send className="mr-1.5 h-4 w-4 text-sky-500" />
                    Telegram
                  </a>
                )}
                {contacts.email && (
                  <a
                    href={`mailto:${contacts.email}`}
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                      "rounded-xl border hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-400 hover:border-amber-500/30 transition-all duration-200"
                    )}
                  >
                    <Mail className="mr-1.5 h-4 w-4 text-amber-500" />
                    Email
                  </a>
                )}
                {contacts.instagram && (
                  <a
                    href={`https://instagram.com/${contacts.instagram}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                      "rounded-xl border hover:bg-pink-500/10 hover:text-pink-600 dark:hover:text-pink-400 hover:border-pink-500/30 transition-all duration-200"
                    )}
                  >
                    <ExternalLink className="mr-1.5 h-4 w-4 text-pink-500" />
                    Instagram
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Status Actions (Sleek Pills Design) */}
          <div className="py-5 border-b space-y-2.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t("table.change_status")}
            </p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(statusConfig).map(([key, config]) => {
                const Icon = config.icon
                const isActive = key === lead.status
                return (
                  <Button
                    key={key}
                    variant={isActive ? "default" : "outline"}
                    size="sm"
                    className={`rounded-full h-8 px-3 text-xs transition-all duration-200 ${
                      isActive 
                        ? `${config.activeBg} font-medium shadow-none border-0` 
                        : `text-muted-foreground hover:bg-muted/80`
                    }`}
                    onClick={() => handleStatusChange(key as Lead["status"])}
                  >
                    <Icon className={`mr-1.5 h-3.5 w-3.5 ${isActive ? "text-white" : config.color}`} />
                    {config.label}
                  </Button>
                )
              })}
            </div>
          </div>

          {/* Form Data Grid */}
          <div className="py-5 border-b space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t("detail.form_data")}
            </p>
            <div className="rounded-xl border bg-card/20 overflow-hidden divide-y divide-border/50">
              {Object.entries(lead.formData).map(([key, value]) => (
                <div
                  key={key}
                  className="group relative flex items-start justify-between p-3 transition-colors hover:bg-muted/30"
                >
                  <div className="space-y-0.5 min-w-0 flex-1 pr-8">
                    <p className="text-xs font-medium text-muted-foreground">{key}</p>
                    <p className="text-sm font-semibold break-words text-foreground">{value}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity rounded-md"
                    onClick={() => copyToClipboard(String(value), key)}
                  >
                    {copiedField === key ? (
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Notes Section */}
          <div className="py-5 border-b space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {t("detail.notes")}
              </p>
              {!notes && <span className="text-xs text-muted-foreground">{t("detail.no_notes")}</span>}
            </div>
            <Textarea
              placeholder={t("detail.notes_placeholder")}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[100px] resize-none rounded-xl border bg-card/30 focus-visible:ring-1"
            />
            <Button
              onClick={handleSaveNotes}
              disabled={isSaving}
              size="sm"
              className="w-full rounded-xl shadow-xs"
            >
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? t("detail.saving") : t("detail.save_notes")}
            </Button>
          </div>

          {/* Danger Zone */}
          <div className="pt-6">
            <Button
              variant="outline"
              size="sm"
              className="w-full rounded-xl border-rose-200 dark:border-rose-950 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/30 transition-all duration-200"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {t("dialog.confirm")}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg">{t("dialog.title")}</DialogTitle>
            <DialogDescription className="text-sm">{t("dialog.desc")}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 flex flex-row gap-2 justify-end">
            <Button variant="outline" className="rounded-xl" onClick={() => setShowDeleteDialog(false)} disabled={isDeleting}>
              {t("dialog.cancel")}
            </Button>
            <Button variant="destructive" className="rounded-xl" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? t("dialog.deleting") : t("dialog.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
