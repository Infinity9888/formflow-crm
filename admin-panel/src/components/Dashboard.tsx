import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { collection, onSnapshot, query, orderBy, doc, updateDoc, deleteDoc, setDoc, getDoc } from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'
import { signOut } from 'firebase/auth'
import { useTranslation } from 'react-i18next'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import {
  Trash2, CheckCircle2, Clock, XCircle, AlertCircle, LogOut, Globe,
  Search, Download, Bell, BellOff, Filter, ArrowUpDown, Plus, X,
  Copy, Check
} from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Tabs, TabsContent, TabsList, TabsTrigger
} from "@/components/ui/tabs"
import { ThemeToggle } from "./ThemeToggle"
import { LeadDetailSheet } from "./LeadDetailSheet"

interface Lead {
  id: string
  status: "new" | "in_progress" | "completed" | "rejected"
  createdAt: string
  createdAtRaw: Date | null
  formData: Record<string, string>
  clientId: string
  source?: string
  notes?: string
}

type StatusFilter = 'all' | Lead['status']

export default function Dashboard() {
  const { t, i18n } = useTranslation()
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  // Delete dialog state (for inline delete from table)
  const [leadToDelete, setLeadToDelete] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const prevLeadCountRef = useRef<number | null>(null)

  const user = auth.currentUser

  // Multi-tenancy (site linking) states
  const [userProfile, setUserProfile] = useState<{ role: 'admin' | 'client', clientId: string, clientIds?: string[] } | null>(null)
  const [userProfileLoading, setUserProfileLoading] = useState(true)
  const [adminSiteFilter, setAdminSiteFilter] = useState<string>('all')

  interface ClientRow {
    id: string
    type: 'new' | 'existing'
    clientId: string
    secretKey: string
  }

  // Setup onboarding form state
  const [clientRows, setClientRows] = useState<ClientRow[]>([
    { id: '1', type: 'existing', clientId: '', secretKey: '' }
  ])
  const [isAdminRole, setIsAdminRole] = useState(false)
  const [isSavingSetup, setIsSavingSetup] = useState(false)

  // Security Verification states
  const [adminMasterKey, setAdminMasterKey] = useState<string>('')
  const [setupError, setSetupError] = useState<string | null>(null)
  const [generatedKeys, setGeneratedKeys] = useState<{ clientId: string; secretKey: string }[] | null>(null)
  const [registeredClients, setRegisteredClients] = useState<{ [clientId: string]: { secretKey?: string, telegramChatId?: string } }>({})
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const addClientRow = () => {
    setClientRows(prev => [
      ...prev,
      { id: Math.random().toString(), type: 'existing', clientId: '', secretKey: '' }
    ])
  }

  const statusConfig = {
    new: { label: t('status.new'), variant: 'default', icon: AlertCircle, color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-l-blue-500' },
    in_progress: { label: t('status.in_progress'), variant: 'secondary', icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-l-amber-500' },
    completed: { label: t('status.completed'), variant: 'outline', icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-l-emerald-500' },
    rejected: { label: t('status.rejected'), variant: 'destructive', icon: XCircle, color: 'text-rose-500', bg: 'bg-rose-500/10', border: 'border-l-rose-500' },
  } as const

  // Play notification sound
  const playNotificationSound = useCallback(() => {
    try {
      const ctx = new AudioContext()
      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()
      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)
      oscillator.frequency.value = 800
      oscillator.type = 'sine'
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5)
      oscillator.start(ctx.currentTime)
      oscillator.stop(ctx.currentTime + 0.5)
    } catch (e) {
      console.log('Audio not available')
    }
  }, [])

  const sendBrowserNotification = useCallback((leadData: Record<string, string>) => {
    if (Notification.permission === 'granted') {
      const name = leadData['name'] || leadData['Имя'] || leadData["Ім'я"] || Object.values(leadData)[0] || 'New Lead'
      new Notification(t('notifications.new_lead'), {
        body: `${name}`,
        icon: '/favicon.ico'
      })
    }
  }, [t])

  // Toggle notifications
  const toggleNotifications = useCallback(async () => {
    if (!notificationsEnabled) {
      if (Notification.permission === 'default') {
        const result = await Notification.requestPermission()
        if (result === 'granted') {
          setNotificationsEnabled(true)
        }
      } else if (Notification.permission === 'granted') {
        setNotificationsEnabled(true)
      }
    } else {
      setNotificationsEnabled(false)
    }
  }, [notificationsEnabled])

  // Load registered clients with keys
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "clients"), (snapshot) => {
      const clientsData: { [clientId: string]: { secretKey?: string, telegramChatId?: string } } = {}
      snapshot.forEach(doc => {
        clientsData[doc.id] = doc.data() as any
      })
      setRegisteredClients(clientsData)
    })
    return () => unsubscribe()
  }, [])

  // Load or create user profile from Firestore
  useEffect(() => {
    if (!user) return
    const userDocRef = doc(db, "users", user.uid)
    const unsubscribe = onSnapshot(userDocRef, async (snapshot) => {
      if (snapshot.exists()) {
        setUserProfile(snapshot.data() as any)
        setUserProfileLoading(false)
      } else {
        const defaultProfile = {
          uid: user.uid,
          email: user.email,
          role: 'client',
          clientId: '',
          clientIds: []
        }
        try {
          await setDoc(userDocRef, defaultProfile)
          setUserProfile(defaultProfile as any)
        } catch (e) {
          console.error("Error creating user profile:", e)
        }
        setUserProfileLoading(false)
      }
    })
    return () => unsubscribe()
  }, [user])

  // Handle saving the client ID link
  const handleSaveSetup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setIsSavingSetup(true)
    setSetupError(null)

    try {
      if (isAdminRole) {
        // Admin verification
        const masterKeyCheck = adminMasterKey.trim()
        if (masterKeyCheck !== 'admin-crm-pass') {
          setSetupError(t('setup.invalid_master'))
          setIsSavingSetup(false)
          return
        }
        
        const userDocRef = doc(db, "users", user.uid)
        await updateDoc(userDocRef, {
          clientId: '',
          role: 'admin'
        })
      } else {
        // Client ID selection for multiple sites
        if (clientRows.length === 0) {
          setSetupError("Будь ласка, додайте хоча б один сайт.")
          setIsSavingSetup(false)
          return
        }

        // Validate each row
        const validatedRows: { clientId: string; secretKey: string; isNew: boolean }[] = []
        const clientIdsSet = new Set<string>()

        for (const row of clientRows) {
          const cid = row.clientId.trim()
          if (!cid) {
            setSetupError("Ідентифікатор сайту не може бути порожнім.")
            setIsSavingSetup(false)
            return
          }
          if (clientIdsSet.has(cid)) {
            setSetupError(`Дублікат сайту: ${cid}. Виберіть або введіть унікальні сайти.`)
            setIsSavingSetup(false)
            return
          }
          clientIdsSet.add(cid)

          if (row.type === 'new') {
            // Check if client doc already exists
            const clientDocRef = doc(db, "clients", cid)
            const clientSnap = await getDoc(clientDocRef)
            // If the document exists and has a key, force them to use "existing"
            if (clientSnap.exists() && clientSnap.data()?.secretKey) {
              setSetupError(`Сайт '${cid}' вже зареєстрований в базі. Спробуйте прив'язати його як існуючий з ключем.`)
              setIsSavingSetup(false)
              return
            }
            validatedRows.push({ clientId: cid, secretKey: '', isNew: true })
          } else {
            // Existing client validation
            const clientDocRef = doc(db, "clients", cid)
            const clientSnap = await getDoc(clientDocRef)
            const data = clientSnap.exists() ? clientSnap.data() : null
            const correctKey = data?.secretKey

            if (!correctKey) {
              // Legacy site ID that exists in leads but doesn't have a key document yet.
              // Auto-generate a new key for it.
              validatedRows.push({ clientId: cid, secretKey: '', isNew: true })
            } else {
              if (row.secretKey.trim().toUpperCase() !== correctKey.toUpperCase()) {
                setSetupError(`Невірний секретний ключ для сайту '${cid}'.`)
                setIsSavingSetup(false)
                return
              }
              validatedRows.push({ clientId: cid, secretKey: correctKey, isNew: false })
            }
          }
        }

        // All rows validated! Now write to Firestore
        const keysToShow: { clientId: string; secretKey: string }[] = []
        const finalClientIds: string[] = []

        for (const vRow of validatedRows) {
          finalClientIds.push(vRow.clientId)
          if (vRow.isNew) {
            // Generate secret key
            const newKey = Math.random().toString(36).substring(2, 10).toUpperCase()
            const clientDocRef = doc(db, "clients", vRow.clientId)
            await setDoc(clientDocRef, {
              secretKey: newKey,
              createdAt: new Date()
            })
            keysToShow.push({ clientId: vRow.clientId, secretKey: newKey })
          }
        }

        // Update user profile in Firestore
        const userDocRef = doc(db, "users", user.uid)
        await updateDoc(userDocRef, {
          clientId: finalClientIds[0] || '', // legacy compatibility
          clientIds: finalClientIds,
          role: 'client'
        })

        // If any new keys were generated, show the success screen with the keys
        if (keysToShow.length > 0) {
          setGeneratedKeys(keysToShow)
        }
      }
    } catch (e) {
      console.error(e)
      setSetupError("Помилка при збереженні. Спробуйте ще раз.")
    } finally {
      setIsSavingSetup(false)
    }
  }

  // Firebase listener
  useEffect(() => {
    const q = query(collection(db, "leads"), orderBy("createdAt", "desc"))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedLeads = snapshot.docs.map(d => {
        const data = d.data()
        const rawDate = data.createdAt?.toDate ? data.createdAt.toDate() : null
        return {
          id: d.id,
          status: data.status || 'new',
          createdAt: rawDate
            ? rawDate.toLocaleString(i18n.language, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
            : t('table.just_now'),
          createdAtRaw: rawDate,
          formData: data.formData || {},
          clientId: data.clientId || 'unknown',
          source: data.source || '',
          notes: data.notes || '',
        } as Lead
      })

      // Check if new lead appeared
      if (notificationsEnabled && prevLeadCountRef.current !== null && fetchedLeads.length > prevLeadCountRef.current) {
        playNotificationSound()
        const newestLead = fetchedLeads[0]
        if (newestLead) sendBrowserNotification(newestLead.formData)
      }
      prevLeadCountRef.current = fetchedLeads.length

      setLeads(fetchedLeads)
      setLoading(false)
    })
    return () => unsubscribe()
  }, [i18n.language, notificationsEnabled, playNotificationSound, sendBrowserNotification, t])

  // Reactively sync details panel lead
  const activeLead = useMemo(() => {
    if (!selectedLead) return null
    return leads.find(l => l.id === selectedLead.id) || selectedLead
  }, [leads, selectedLead])

  // Get all unique clientIds present in the database
  const uniqueClientIds = useMemo(() => {
    const ids = new Set<string>()
    leads.forEach(lead => {
      if (lead.clientId) ids.add(lead.clientId)
    })
    return Array.from(ids).sort()
  }, [leads])

  // Filter leads based on tenant/client permissions (before applying search or status filter)
  const clientLeads = useMemo(() => {
    return leads.filter(lead => {
      if (userProfile) {
        if (userProfile.role === 'client') {
          const profileIds = userProfile.clientIds || (userProfile.clientId ? [userProfile.clientId] : [])
          if (profileIds.length > 0) {
            return profileIds.includes(lead.clientId)
          }
          return false
        } else if (userProfile.role === 'admin' && adminSiteFilter !== 'all') {
          return lead.clientId === adminSiteFilter
        }
      }
      return true
    })
  }, [leads, userProfile, adminSiteFilter])

  // Filtered leads for display (applying status filter and search query)
  const filteredLeads = useMemo(() => {
    return clientLeads.filter(lead => {
      // 1. Status filter
      if (statusFilter !== 'all' && lead.status !== statusFilter) return false

      // 2. Text search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchesFormData = Object.values(lead.formData).some(v =>
          String(v).toLowerCase().includes(q)
        )
        const matchesSource = (lead.source || '').toLowerCase().includes(q)
        const matchesNotes = (lead.notes || '').toLowerCase().includes(q)
        const matchesClientId = (lead.clientId || '').toLowerCase().includes(q)
        return matchesFormData || matchesSource || matchesNotes || matchesClientId
      }

      return true
    })
  }, [clientLeads, statusFilter, searchQuery])

  // Debug logging
  console.log("DEBUG CRM STATUS:", {
    userProfile,
    leadsCount: leads.length,
    uniqueClientIds,
    adminSiteFilter,
    clientLeadsCount: clientLeads.length,
    filteredLeadsCount: filteredLeads.length
  });

  const handleStatusChange = async (id: string, newStatus: Lead['status']) => {
    try {
      await updateDoc(doc(db, "leads", id), { status: newStatus })
    } catch (error) {
      console.error("Error updating status:", error)
    }
  }

  const confirmDelete = async () => {
    if (!leadToDelete) return
    setIsDeleting(true)
    try {
      await deleteDoc(doc(db, "leads", leadToDelete))
      setLeadToDelete(null)
    } catch (error) {
      console.error("Error deleting lead:", error)
    } finally {
      setIsDeleting(false)
    }
  }

  // Export CSV (Excel compatible)
  const exportToCSV = useCallback(() => {
    if (filteredLeads.length === 0) return

    // Collect all unique form data keys
    const allKeys = new Set<string>()
    filteredLeads.forEach(lead => {
      Object.keys(lead.formData).forEach(k => allKeys.add(k))
    })
    const formKeys = Array.from(allKeys)

    const headers = [t('table.col_status'), t('table.col_date'), t('detail.source'), t('detail.notes'), ...formKeys]
    const rows = filteredLeads.map(lead => {
      const statusLabel = statusConfig[lead.status as keyof typeof statusConfig]?.label || lead.status
      return [
        statusLabel,
        lead.createdAt,
        lead.source || '',
        (lead.notes || '').replace(/\n/g, ' '),
        ...formKeys.map(k => (lead.formData[k] || '').replace(/\n/g, ' '))
      ]
    })

    // Create CSV content with semicolon separator
    const csvContent = [
      headers.join(';'),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
    ].join('\n')

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `leads_${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }, [filteredLeads, statusConfig, t])

  const handleLogout = () => signOut(auth)
  const changeLanguage = (lng: string) => i18n.changeLanguage(lng)

  const newLeadsCount = clientLeads.filter(l => l.status === 'new').length
  const activeLeadsCount = clientLeads.filter(l => l.status === 'in_progress').length
  const completedCount = clientLeads.filter(l => l.status === 'completed').length

  const openLeadDetail = (lead: Lead) => {
    setSelectedLead(lead)
    setSheetOpen(true)
  }

  // Get primary readable label for a lead card
  const getLeadTitle = (lead: Lead) => {
    const entries = Object.entries(lead.formData)
    // Find name-like field
    const nameEntry = entries.find(([k]) => {
      const kl = k.toLowerCase()
      return kl.includes('name') || kl.includes('имя') || kl.includes('імя') || kl.includes("ім'я")
    })
    if (nameEntry) return nameEntry[1]

    // Fallback to first non-phone field or first field
    const firstVal = entries[0]?.[1] || '—'
    return firstVal
  }

  const getLeadSubtitle = (lead: Lead) => {
    const entries = Object.entries(lead.formData)
    const phoneEntry = entries.find(([k]) => {
      const kl = k.toLowerCase()
      return kl.includes('phone') || kl.includes('тел') || kl.includes('номер')
    })
    if (phoneEntry) return phoneEntry[1]

    return entries[1]?.[1] || ''
  }

  if (userProfileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground animate-pulse">Loading profile...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 max-w-7xl mx-auto">
      {/* Top Navigation / Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 dark:from-blue-400 dark:via-indigo-400 dark:to-violet-400 bg-clip-text text-transparent">
            {t('dashboard.title')}
            {userProfile && (
              <span className="text-lg font-medium ml-3 border bg-muted/50 px-2.5 py-0.5 rounded-lg select-none">
                {userProfile.role === 'admin' ? (
                  <span className="text-indigo-600 dark:text-indigo-400 font-semibold">Admin Mode</span>
                ) : (
                  <span className="text-muted-foreground font-medium select-all">
                    {userProfile.clientIds && userProfile.clientIds.length > 0
                      ? userProfile.clientIds.join(', ')
                      : userProfile.clientId || 'No client ID'}
                  </span>
                )}
              </span>
            )}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">{t('dashboard.subtitle')}</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Notifications Toggle */}
          <Tooltip>
            <TooltipTrigger render={
              <Button
                variant={notificationsEnabled ? "default" : "outline"}
                size="icon"
                onClick={toggleNotifications}
                className="shrink-0 rounded-xl"
              >
                {notificationsEnabled ? (
                  <Bell className="h-4 w-4" />
                ) : (
                  <BellOff className="h-4 w-4" />
                )}
              </Button>
            }>
              {notificationsEnabled ? t('notifications.enabled') : t('notifications.disabled')}
            </TooltipTrigger>
            <TooltipContent>
              {notificationsEnabled ? t('notifications.enabled') : t('notifications.disabled')}
            </TooltipContent>
          </Tooltip>

          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Language Switcher */}
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="icon" className="shrink-0 rounded-xl" />}>
              <Globe className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl">
              <DropdownMenuItem onClick={() => changeLanguage('uk')} className="rounded-lg cursor-pointer">Українська</DropdownMenuItem>
              <DropdownMenuItem onClick={() => changeLanguage('ru')} className="rounded-lg cursor-pointer">Русский</DropdownMenuItem>
              <DropdownMenuItem onClick={() => changeLanguage('en')} className="rounded-lg cursor-pointer">English</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User Profile */}
          {user && (
            <div className="flex items-center gap-3 pl-3 border-l">
              <div className="hidden sm:flex flex-col text-right">
                <div className="flex items-center gap-1.5 justify-end">
                  <span className="text-sm font-medium">{user.displayName || user.email?.split('@')[0]}</span>
                  {userProfile && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                      {userProfile.role === 'admin'
                        ? 'Admin'
                        : userProfile.clientIds && userProfile.clientIds.length > 0
                        ? `${userProfile.clientIds.length} site(s)`
                        : userProfile.clientId || 'No site'}
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">{user.email}</span>
              </div>
              <Avatar className="h-8 w-8">
                <AvatarImage src={user.photoURL || ''} alt="Avatar" />
                <AvatarFallback>{user.email?.charAt(0).toUpperCase() || 'U'}</AvatarFallback>
              </Avatar>
              <Tooltip>
                <TooltipTrigger render={<Button variant="ghost" size="icon" onClick={handleLogout} className="rounded-xl" />}>
                  <LogOut className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                </TooltipTrigger>
                <TooltipContent>{t('dashboard.logout')}</TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>
      </div>

      {/* If client is not linked to any website yet, show the Link Account view */}
      {userProfile && userProfile.role === 'client' && (((!userProfile.clientIds || userProfile.clientIds.length === 0) && userProfile.clientId === '') || generatedKeys) ? (
        <div className="max-w-md mx-auto py-8">
          {generatedKeys ? (
            /* Success / New Keys Display Card */
            <Card className="shadow-lg rounded-2xl border-t-4 border-t-emerald-500 animate-in fade-in zoom-in-95 duration-200">
              <CardHeader className="space-y-1 text-center">
                <CardTitle className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                  {t('setup.new_key_title')}
                </CardTitle>
                <CardDescription>{t('setup.new_key_desc')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  {generatedKeys.map(k => {
                    const isCopied = copiedId === k.clientId
                    return (
                      <div 
                        key={k.clientId} 
                        onClick={() => {
                          navigator.clipboard.writeText(k.secretKey)
                          setCopiedId(k.clientId)
                          setTimeout(() => setCopiedId(null), 2000)
                        }}
                        className="group relative flex flex-col items-center gap-1.5 p-4 bg-muted hover:bg-muted/80 rounded-xl border border-dashed border-border cursor-pointer transition-all duration-200"
                      >
                        <span className="text-xs text-muted-foreground font-medium">
                          Сайт: <span className="font-mono text-foreground font-semibold">{k.clientId}</span>
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-2xl font-bold tracking-widest text-foreground">
                            {k.secretKey}
                          </span>
                          {isCopied ? (
                            <Check className="h-5 w-5 text-emerald-500 animate-in zoom-in duration-200" />
                          ) : (
                            <Copy className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors duration-200" />
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground/60 mt-0.5">
                          {isCopied ? "Скопійовано!" : "Натисніть, щоб скопіювати"}
                        </span>
                      </div>
                    )
                  })}
                </div>
                <Button 
                  onClick={() => {
                    setGeneratedKeys(null)
                  }} 
                  className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white mt-4"
                >
                  {t('setup.continue_btn')}
                </Button>
              </CardContent>
            </Card>
          ) : (
            /* Setup / Link Card */
            <Card className="shadow-lg rounded-2xl border-t-4 border-t-indigo-500">
              <CardHeader className="space-y-1 text-center">
                <CardTitle className="text-2xl font-bold tracking-tight">{t('setup.title')}</CardTitle>
                <CardDescription>{t('setup.desc')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <form onSubmit={handleSaveSetup} className="space-y-6">
                  
                  {setupError && (
                    <div className="p-3 text-sm text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl">
                      {setupError}
                    </div>
                  )}

                  {/* Administrator Role Option */}
                  <div className="flex items-center gap-2 pb-4 border-b">
                    <input
                      type="checkbox"
                      id="admin-role-opt"
                      checked={isAdminRole}
                      onChange={(e) => {
                        setIsAdminRole(e.target.checked)
                        setSetupError(null)
                      }}
                      className="mr-2 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <label htmlFor="admin-role-opt" className="text-sm font-medium text-foreground cursor-pointer select-none">
                      {t('setup.role_admin_opt')}
                    </label>
                  </div>

                  {isAdminRole ? (
                    /* Admin Master Key Input */
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-foreground">{t('setup.master_key')}</label>
                      <Input
                        type="password"
                        placeholder={t('setup.master_placeholder')}
                        value={adminMasterKey}
                        onChange={(e) => setAdminMasterKey(e.target.value)}
                        className="rounded-xl"
                        required
                      />
                    </div>
                  ) : (
                    /* Multiple Client IDs Setup */
                    <div className="space-y-4">
                      {clientRows.map((row) => (
                        <div key={row.id} className="p-4 rounded-xl border bg-muted/30 space-y-4 relative">
                          {clientRows.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => setClientRows(prev => prev.filter(r => r.id !== row.id))}
                              className="absolute top-2 right-2 text-muted-foreground hover:text-destructive rounded-lg h-8 w-8"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                          
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant={row.type === 'existing' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => {
                                setClientRows(prev => prev.map(r => r.id === row.id ? { ...r, type: 'existing', secretKey: '', clientId: '' } : r))
                              }}
                              className="rounded-lg text-xs"
                            >
                              {t('setup.site_type_existing')}
                            </Button>
                            <Button
                              type="button"
                              variant={row.type === 'new' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => {
                                setClientRows(prev => prev.map(r => r.id === row.id ? { ...r, type: 'new', secretKey: '', clientId: '' } : r))
                              }}
                              className="rounded-lg text-xs"
                            >
                              {t('setup.site_type_new')}
                            </Button>
                          </div>

                          <div className="space-y-3">
                            <div className="space-y-1">
                              <label className="text-xs font-semibold text-muted-foreground">{t('setup.site_id_label')}</label>
                              {row.type === 'existing' && uniqueClientIds.length > 0 ? (
                                <div className="space-y-2">
                                  <Select 
                                    value={row.clientId} 
                                    onValueChange={(val) => {
                                      setClientRows(prev => prev.map(r => r.id === row.id ? { ...r, clientId: val || '' } : r))
                                      setSetupError(null)
                                    }}
                                  >
                                    <SelectTrigger className="w-full rounded-xl bg-card">
                                      <SelectValue placeholder="---" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                      {uniqueClientIds.map(id => (
                                        <SelectItem key={id} value={id} className="rounded-lg">{id}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              ) : (
                                <Input 
                                  placeholder={t('setup.client_placeholder')}
                                  value={row.clientId}
                                  onChange={(e) => {
                                    const val = e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '')
                                    setClientRows(prev => prev.map(r => r.id === row.id ? { ...r, clientId: val } : r))
                                    setSetupError(null)
                                  }}
                                  className="rounded-xl font-mono bg-card"
                                  required
                                />
                              )}
                            </div>

                            {row.type === 'existing' && row.clientId && (
                              registeredClients[row.clientId]?.secretKey ? (
                                <div className="space-y-1 animate-in fade-in slide-in-from-top-1 duration-200">
                                  <label className="text-xs font-semibold text-muted-foreground">{t('setup.enter_key')}</label>
                                  <Input
                                    type="text"
                                    placeholder={t('setup.key_placeholder')}
                                    value={row.secretKey}
                                    onChange={(e) => {
                                      const val = e.target.value.toUpperCase()
                                      setClientRows(prev => prev.map(r => r.id === row.id ? { ...r, secretKey: val } : r))
                                      setSetupError(null)
                                    }}
                                    className="rounded-xl uppercase font-mono bg-card"
                                    maxLength={8}
                                    required
                                  />
                                </div>
                              ) : (
                                <div className="p-3 text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-xl animate-in fade-in slide-in-from-top-1 duration-200">
                                  Цей сайт ще не має секретного ключа в системі. Він буде автоматично згенерований та показаний вам після збереження.
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      ))}

                      <Button
                        type="button"
                        variant="outline"
                        onClick={addClientRow}
                        className="w-full rounded-xl border-dashed py-5 border-2 flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground"
                      >
                        <Plus className="h-4 w-4" />
                        {t('setup.add_site_btn')}
                      </Button>
                    </div>
                  )}

                  <Button 
                    type="submit" 
                    className="w-full rounded-xl mt-4" 
                    disabled={isSavingSetup || (isAdminRole && !adminMasterKey)}
                  >
                    {isSavingSetup ? "..." : t('setup.save_btn')}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-4">
        <Card
          className={`shadow-sm rounded-2xl border-l-4 border-l-blue-500 cursor-pointer transition-all hover:shadow-md ${statusFilter === 'new' ? 'ring-2 ring-blue-500/50' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'new' ? 'all' : 'new')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.new_leads')}</CardTitle>
            <AlertCircle className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{loading ? "..." : newLeadsCount}</div>
            <p className="text-xs text-muted-foreground mt-1">{t('dashboard.waiting')}</p>
          </CardContent>
        </Card>
        <Card
          className={`shadow-sm rounded-2xl border-l-4 border-l-amber-500 cursor-pointer transition-all hover:shadow-md ${statusFilter === 'in_progress' ? 'ring-2 ring-amber-500/50' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'in_progress' ? 'all' : 'in_progress')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.in_progress')}</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{loading ? "..." : activeLeadsCount}</div>
            <p className="text-xs text-muted-foreground mt-1">{t('dashboard.talking')}</p>
          </CardContent>
        </Card>
        <Card
          className={`shadow-sm rounded-2xl border-l-4 border-l-emerald-500 cursor-pointer transition-all hover:shadow-md ${statusFilter === 'completed' ? 'ring-2 ring-emerald-500/50' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'completed' ? 'all' : 'completed')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.completed')}</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{loading ? "..." : completedCount}</div>
            <p className="text-xs text-muted-foreground mt-1">{t('dashboard.done')}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.total_leads')}</CardTitle>
            <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{loading ? "..." : clientLeads.length}</div>
            <p className="text-xs text-muted-foreground mt-1">{t('dashboard.all_time')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search, Filter & Tabs View Bar */}
      <Tabs defaultValue="list" className="w-full space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row flex-1 gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('search.placeholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 rounded-xl border bg-card/50"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger className="w-full sm:w-[180px] rounded-xl bg-card/50">
                <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder={t('search.filter_status')} />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all" className="rounded-lg">{t('search.all')}</SelectItem>
                <SelectItem value="new" className="rounded-lg">{t('status.new')}</SelectItem>
                <SelectItem value="in_progress" className="rounded-lg">{t('status.in_progress')}</SelectItem>
                <SelectItem value="completed" className="rounded-lg">{t('status.completed')}</SelectItem>
                <SelectItem value="rejected" className="rounded-lg">{t('status.rejected')}</SelectItem>
              </SelectContent>
            </Select>
            {userProfile && userProfile.role === 'admin' && (
              <Select value={adminSiteFilter} onValueChange={(val) => setAdminSiteFilter(val || 'all')}>
                <SelectTrigger className="w-full sm:w-[200px] rounded-xl bg-card/50">
                  <Globe className="mr-2 h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder={t('search.filter_client')} />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all" className="rounded-lg">{t('search.all_clients')}</SelectItem>
                  {uniqueClientIds.map(id => (
                    <SelectItem key={id} value={id} className="rounded-lg">{id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {userProfile && userProfile.role === 'client' && (
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" className="shrink-0 rounded-xl bg-[#2AABEE]/10 text-[#2AABEE] hover:bg-[#2AABEE]/20 hover:text-[#2AABEE] border-[#2AABEE]/20">
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.223-.548.223l.188-2.85 5.18-4.686c.223-.204-.054-.31-.346-.116l-6.405 4.032-2.756-.86c-.6-.188-.614-.6.126-.89l10.742-4.14c.498-.184.933.11.72.11z"/></svg>
                    Telegram
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-2xl max-w-md">
                  <DialogHeader>
                    <DialogTitle>Налаштування Telegram</DialogTitle>
                    <DialogDescription>Отримуйте миттєві сповіщення про нові ліди прямо в Telegram.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    {(userProfile.clientIds || [userProfile.clientId]).filter(Boolean).map(cid => {
                      const clientData = registeredClients[cid];
                      const isConnected = !!clientData?.telegramChatId;
                      return (
                        <div key={cid} className="flex items-center justify-between p-3 rounded-xl border bg-muted/30">
                          <div className="flex flex-col">
                            <span className="font-semibold">{cid}</span>
                            <span className="text-xs text-muted-foreground">
                              {isConnected ? (
                                <span className="text-emerald-500 font-medium flex items-center gap-1"><Check className="w-3 h-3"/> Активно</span>
                              ) : 'Не підключено'}
                            </span>
                          </div>
                          {isConnected ? (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="rounded-lg text-xs hover:bg-destructive/10 hover:text-destructive"
                              onClick={async () => {
                                await updateDoc(doc(db, "clients", cid), { telegramChatId: null })
                              }}
                            >
                              Відключити
                            </Button>
                          ) : (
                            <Button 
                              size="sm" 
                              className="rounded-lg text-xs bg-[#2AABEE] hover:bg-[#2AABEE]/90 text-white"
                              onClick={() => {
                                window.open(`https://t.me/formfloww_bot?start=${clientData?.secretKey}`, '_blank')
                              }}
                              disabled={!clientData?.secretKey}
                            >
                              Підключити
                            </Button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </DialogContent>
              </Dialog>
            )}
            <Tooltip>
              <TooltipTrigger render={
                <Button
                  variant="outline"
                  onClick={exportToCSV}
                  disabled={filteredLeads.length === 0}
                  className="shrink-0 rounded-xl"
                />
              }>
                <Download className="mr-2 h-4 w-4" />
                CSV
              </TooltipTrigger>
              <TooltipContent>{t('search.export_csv')}</TooltipContent>
            </Tooltip>
          </div>

          {/* View Toggler (List vs Kanban Board) */}
          <TabsList className="grid w-full md:w-[280px] grid-cols-2 rounded-xl p-1 bg-muted/60 shrink-0">
            <TabsTrigger value="list" className="rounded-lg">{t('dashboard.view_list')}</TabsTrigger>
            <TabsTrigger value="kanban" className="rounded-lg">{t('dashboard.view_kanban')}</TabsTrigger>
          </TabsList>
        </div>

        {/* Tab 1: Table List View */}
        <TabsContent value="list" className="focus-visible:outline-none">
          <Card className="shadow-sm rounded-2xl overflow-hidden border">
            <CardHeader className="pb-3 bg-card/30">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-bold">{t('table.title')}</CardTitle>
                  <CardDescription>
                    {statusFilter !== 'all' || searchQuery
                      ? t('table.showing', { count: filteredLeads.length, total: clientLeads.length })
                      : t('table.desc')}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="w-[140px] pl-6">{t('table.col_status')}</TableHead>
                      <TableHead className="w-[140px]">{t('table.col_date')}</TableHead>
                      <TableHead>{t('table.col_details')}</TableHead>
                      <TableHead className="w-[120px]">{t('detail.source')}</TableHead>
                      <TableHead className="w-[80px] pr-6 text-right">{t('table.col_actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="h-28 text-center text-muted-foreground">
                          <div className="flex justify-center items-center gap-2">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                            {t('table.loading')}
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : filteredLeads.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="h-28 text-center text-muted-foreground">
                          {searchQuery || statusFilter !== 'all' ? t('table.no_results') : t('table.empty')}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredLeads.map((lead) => {
                        const statusKey = lead.status as keyof typeof statusConfig
                        const statusInfo = statusConfig[statusKey] || statusConfig.new
                        const StatusIcon = statusInfo.icon

                        const title = getLeadTitle(lead)
                        const subtitle = getLeadSubtitle(lead)
                        const entriesCount = Object.keys(lead.formData).length

                        return (
                          <TableRow
                            key={lead.id}
                            className="group hover:bg-muted/30 transition-colors cursor-pointer border-b"
                            onClick={() => openLeadDetail(lead)}
                          >
                            <TableCell onClick={(e) => e.stopPropagation()} className="pl-6 py-4">
                              <DropdownMenu>
                                <DropdownMenuTrigger className="flex h-8 items-center justify-start rounded-lg px-2.5 text-xs font-medium hover:bg-accent hover:text-accent-foreground outline-none border transition-colors">
                                  <StatusIcon className={`mr-2 h-3.5 w-3.5 ${statusInfo.color}`} />
                                  <span>{statusInfo.label}</span>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="rounded-xl">
                                  <div className="px-2.5 py-1.5 text-xs font-semibold text-muted-foreground">{t('table.change_status')}</div>
                                  <DropdownMenuSeparator />
                                  {Object.entries(statusConfig).map(([key, config]) => (
                                    <DropdownMenuItem
                                      key={key}
                                      onClick={() => handleStatusChange(lead.id, key as Lead['status'])}
                                      className="rounded-lg cursor-pointer"
                                    >
                                      <config.icon className={`mr-2 h-4 w-4 ${config.color}`} />
                                      {config.label}
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>

                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap py-4">
                              {lead.createdAt}
                            </TableCell>

                            <TableCell className="py-4">
                              <div className="flex flex-col">
                                <span className="font-semibold text-sm truncate max-w-[280px] text-foreground">{title}</span>
                                {subtitle && (
                                  <span className="text-xs text-muted-foreground truncate max-w-[280px] mt-0.5">{subtitle}</span>
                                )}
                                {entriesCount > 2 && (
                                  <span className="text-[10px] text-primary/80 font-medium mt-1 inline-block bg-primary/5 rounded px-1.5 py-0.5 w-fit">
                                    +{entriesCount - 2} {t('table.more_fields')}
                                  </span>
                                )}
                              </div>
                            </TableCell>

                            <TableCell className="text-xs text-muted-foreground py-4">
                              {lead.source ? (
                                <Badge variant="outline" className="text-xs font-normal truncate max-w-[100px] rounded-lg">
                                  {lead.source}
                                </Badge>
                              ) : '—'}
                            </TableCell>

                            <TableCell className="text-right pr-6 py-4" onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity rounded-lg h-8 w-8"
                                onClick={() => setLeadToDelete(lead.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Grouped Tables View */}
        <TabsContent value="kanban" className="focus-visible:outline-none">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {(['new', 'in_progress', 'completed', 'rejected'] as Lead['status'][]).map((status) => {
              const config = statusConfig[status]
              const Icon = config.icon
              const columnLeads = filteredLeads.filter(l => l.status === status)

              return (
                <Card key={status} className="shadow-sm rounded-2xl overflow-hidden border flex flex-col h-[400px]">
                  {/* Status Header */}
                  <CardHeader className="pb-3 bg-card/30 flex flex-row items-center justify-between space-y-0 shrink-0">
                    <div className="flex items-center gap-2">
                      <div className={`h-2.5 w-2.5 rounded-full ${config.color.split(' ')[0]} bg-current`} />
                      <CardTitle className="text-sm font-bold uppercase tracking-wider text-foreground">{config.label}</CardTitle>
                    </div>
                    <Badge variant="secondary" className="rounded-lg px-2 py-0.5 text-xs font-bold bg-muted-foreground/10 text-muted-foreground">
                      {columnLeads.length}
                    </Badge>
                  </CardHeader>
                  <CardContent className="p-0 flex-1 overflow-hidden flex flex-col">
                    <div className="flex-1 overflow-y-auto pr-1">
                      {columnLeads.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full min-h-[250px] text-center text-muted-foreground p-6">
                          <div className="rounded-full bg-muted p-3 mb-3">
                            <Icon className="h-6 w-6 text-muted-foreground/60" />
                          </div>
                          <span className="text-xs font-medium">{t('kanban.no_leads')}</span>
                        </div>
                      ) : (
                        <Table>
                          <TableHeader className="bg-muted/10 sticky top-0 z-10 backdrop-blur-xs">
                            <TableRow>
                              <TableHead className="pl-4 py-2 text-[11px] font-semibold text-muted-foreground">{t('table.col_details')}</TableHead>
                              <TableHead className="pr-4 py-2 text-[11px] font-semibold text-muted-foreground text-right w-[95px]">{t('table.col_actions')}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {columnLeads.map((lead) => {
                              const title = getLeadTitle(lead)
                              const subtitle = getLeadSubtitle(lead)

                              return (
                                <TableRow
                                  key={lead.id}
                                  className="group/row hover:bg-muted/30 cursor-pointer transition-colors border-b last:border-0"
                                  onClick={() => openLeadDetail(lead)}
                                >
                                  {/* Lead Info */}
                                  <TableCell className="pl-4 py-2 font-medium">
                                    <div className="flex flex-col min-w-0 max-w-[140px] sm:max-w-[180px]">
                                      <span className="text-xs font-semibold truncate text-foreground group-hover/row:text-primary transition-colors">
                                        {title}
                                      </span>
                                      {subtitle && (
                                        <span className="text-[10px] text-muted-foreground truncate mt-0.5">{subtitle}</span>
                                      )}
                                      {lead.source && (
                                        <span className="mt-1">
                                          <Badge variant="outline" className="text-[8px] py-0 px-1 font-normal rounded-md max-w-[90px] truncate">
                                            {lead.source}
                                          </Badge>
                                        </span>
                                      )}
                                    </div>
                                  </TableCell>

                                  {/* Actions */}
                                  <TableCell className="pr-4 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                                    <div className="flex flex-col sm:flex-row items-end sm:items-center justify-end gap-1.5">
                                      {/* Stage Transition Button */}
                                      <div className="flex gap-1">
                                        {status === 'new' && (
                                          <Button
                                            variant="outline"
                                            size="xs"
                                            onClick={() => handleStatusChange(lead.id, 'in_progress')}
                                            className="h-5 rounded-md px-1.5 text-[9px] font-semibold hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-400 hover:border-amber-500/30"
                                          >
                                            <Clock className="h-2.5 w-2.5 mr-0.5 text-amber-500" />
                                            {t('status.in_progress')}
                                          </Button>
                                        )}

                                        {status === 'in_progress' && (
                                          <div className="flex flex-col gap-1 sm:flex-row">
                                            <Button
                                              variant="outline"
                                              size="xs"
                                              onClick={() => handleStatusChange(lead.id, 'completed')}
                                              className="h-5 rounded-md px-1.5 text-[9px] font-semibold hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-500/30"
                                            >
                                              <CheckCircle2 className="h-2.5 w-2.5 mr-0.5 text-emerald-500" />
                                              {t('status.completed')}
                                            </Button>
                                            <Button
                                              variant="outline"
                                              size="xs"
                                              onClick={() => handleStatusChange(lead.id, 'rejected')}
                                              className="h-5 rounded-md px-1.5 text-[9px] font-semibold hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-500/30"
                                            >
                                              <XCircle className="h-2.5 w-2.5 mr-0.5 text-rose-500" />
                                              {t('status.rejected')}
                                            </Button>
                                          </div>
                                        )}

                                        {(status === 'completed' || status === 'rejected') && (
                                          <Button
                                            variant="outline"
                                            size="xs"
                                            onClick={() => handleStatusChange(lead.id, 'in_progress')}
                                            className="h-5 rounded-md px-1.5 text-[9px] font-semibold hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-400 hover:border-amber-500/30"
                                          >
                                            <Clock className="h-2.5 w-2.5 mr-0.5 text-amber-500" />
                                            {t('status.in_progress')}
                                          </Button>
                                        )}
                                      </div>

                                      {/* Quick Delete */}
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-5 w-5 text-muted-foreground/60 hover:text-destructive rounded-md transition-colors shrink-0"
                                        onClick={() => setLeadToDelete(lead.id)}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )
                            })}
                          </TableBody>
                        </Table>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* Delete Dialog */}
      <Dialog open={!!leadToDelete} onOpenChange={(open) => !open && setLeadToDelete(null)}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg">{t('dialog.title')}</DialogTitle>
            <DialogDescription className="text-sm">{t('dialog.desc')}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 flex flex-row gap-2 justify-end">
            <Button variant="outline" className="rounded-xl" onClick={() => setLeadToDelete(null)} disabled={isDeleting}>
              {t('dialog.cancel')}
            </Button>
            <Button variant="destructive" className="rounded-xl" onClick={confirmDelete} disabled={isDeleting}>
              {isDeleting ? t('dialog.deleting') : t('dialog.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lead Detail Sheet */}
      <LeadDetailSheet
        lead={activeLead}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onDeleted={() => setSelectedLead(null)}
      />
        </>
      )}
    </div>
  )
}
