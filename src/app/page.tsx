"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import {
  Send,
  User,
  Bot,
  PanelRightOpen,
  PanelRightClose,
  Plus,
  AlertCircle,
  RefreshCw,
  Settings,
  LogOut,
} from "lucide-react"
import { useChat, type Message as AIMessage } from "ai/react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Avatar } from "@/components/ui/avatar"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

// Extend the AI SDK Message type with our additional properties
interface Message extends AIMessage {
  timestamp: Date
}

interface Conversation {
  id: string
  title: string
  messages: Message[]
  createdAt: Date
  titleGenerated?: boolean
}

// Helper function to parse/clean the incoming message string
function parseMessage(message: string): string {
  try {
    // Attempt to parse if the message was JSON-stringified on the server
    return JSON.parse(message)
  } catch {
    // Fallback: Remove wrapping quotes (if any) and replace escaped newlines with real newlines
    if (message.startsWith('"') && message.endsWith('"')) {
      message = message.substring(1, message.length - 1)
    }
    return message.replace(/\\n/g, "\n")
  }
}

export default function ChatInterface() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConversation, setActiveConversation] = useState<string | null>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true)
  const [isConversationSwitching, setIsConversationSwitching] = useState<boolean>(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  // Get the active conversation
  const getActiveConversation = () => {
    return conversations.find((conv) => conv.id === activeConversation) || null
  }

  // Initialize AI chat for the current conversation
  const { messages, input, handleInputChange, handleSubmit, isLoading, setMessages, error, reload } = useChat({
    api: "/api/chat",
    id: activeConversation || undefined,
    onError: (error) => {
      console.error("Chat error:", error)
    },
    onFinish: () => {
      if (activeConversation) {
        setConversations((prevConversations) =>
          prevConversations.map((conv) => {
            return conv
          }),
        )
      }
    },
  })

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsSidebarOpen(false)
      }
    }

    handleResize()
    window.addEventListener("resize", handleResize)

    return () => {
      window.removeEventListener("resize", handleResize)
    }
  }, [])

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const createNewConversation = () => {
    const newConversation: Conversation = {
      id: Date.now().toString(),
      title: "New conversation",
      messages: [],
      createdAt: new Date(),
    }

    setConversations((prev) => [newConversation, ...prev])
    setActiveConversation(newConversation.id)

    if (activeConversation) {
      setMessages([])
    }
  }

  useEffect(() => {
    if (conversations.length === 0 && !activeConversation) {
      createNewConversation()
    }
  }, [conversations.length, activeConversation])

  useEffect(() => {
    if (activeConversation && !isConversationSwitching) {
      setIsConversationSwitching(true)

      const currentConv = getActiveConversation()
      if (currentConv) {
        const chatMessages = currentConv.messages.map(({ id, role, content }) => ({
          id,
          role,
          content,
        }))

        setMessages(chatMessages)

        setTimeout(() => {
          setIsConversationSwitching(false)
        }, 100)
      } else {
        setIsConversationSwitching(false)
      }
    }
  }, [activeConversation])

  useEffect(() => {
    if (activeConversation && !isConversationSwitching && messages.length > 0) {
      setConversations((prevConversations) =>
        prevConversations.map((conv) => {
          if (conv.id === activeConversation) {
            const updatedMessages = messages.map((msg) => ({
              ...msg,
              timestamp: new Date(),
            }))

            let title = conv.title
            const titleGenerated = conv.titleGenerated || false

            if (conv.messages.length === 0 && messages.length > 0 && messages[0].role === "user" && !titleGenerated) {
              title = messages[0].content.substring(0, 30) + (messages[0].content.length > 30 ? "..." : "")
            }

            return {
              ...conv,
              title,
              titleGenerated,
              messages: updatedMessages,
            }
          }
          return conv
        }),
      )
    }
  }, [messages, activeConversation, isConversationSwitching])

  const handleMessageSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!input.trim() || !activeConversation) {
      return
    }

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
    }

    handleSubmit(e)
  }

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    handleInputChange(e)
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = "auto"
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      const form = e.currentTarget.form
      if (form) form.requestSubmit()
    }
  }

  const deleteConversation = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()

    const updatedConversations = conversations.filter((conv) => conv.id !== id)
    setConversations(updatedConversations)

    if (id === activeConversation) {
      setActiveConversation(updatedConversations.length > 0 ? updatedConversations[0].id : null)
      if (updatedConversations.length === 0) {
        createNewConversation()
      }
    }
  }

  const navigateToSettings = () => {
    console.log("Navigate to settings")
    alert("Settings page would open here")
  }

  const handleLogout = () => {
    console.log("Logout")
    alert("Logout would happen here")
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <Button className="w-full justify-start gap-2" onClick={createNewConversation}>
          <Plus size={16} />
          New conversation
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-2 space-y-1">
          {conversations.map((conversation) => (
            <Button
              key={conversation.id}
              variant={activeConversation === conversation.id ? "secondary" : "ghost"}
              className="w-full justify-start h-auto py-3 px-3 font-normal"
              onClick={() => setActiveConversation(conversation.id)}
            >
              <div className="flex items-center justify-between w-full">
                <span className="truncate">{conversation.title}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 hover:opacity-100 focus:opacity-100"
                  onClick={(e) => deleteConversation(conversation.id, e)}
                >
                  <span className="sr-only">Delete</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4"
                  >
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                </Button>
              </div>
            </Button>
          ))}
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* Desktop Sidebar */}
      <div
        className={cn(
          "hidden md:flex flex-col border-r border-border transition-all duration-300",
          isSidebarOpen ? "w-64" : "w-0 overflow-hidden",
        )}
      >
        <SidebarContent />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col h-full">
        {/* Header */}
        <header className="flex items-center justify-between px-4 h-14 border-b shrink-0">
          <div className="flex items-center gap-4">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <PanelRightOpen size={20} />
                  <span className="sr-only">Toggle sidebar</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-80">
                <SidebarContent />
              </SheetContent>
            </Sheet>

            <Button
              variant="ghost"
              size="icon"
              className="hidden md:flex"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            >
              {isSidebarOpen ? <PanelRightClose size={20} /> : <PanelRightOpen size={20} />}
              <span className="sr-only">Toggle sidebar</span>
            </Button>

            <h2 className="text-base font-medium text-foreground hidden md:block">
              {getActiveConversation()?.title || "New conversation"}
            </h2>
          </div>

          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold">NIC - Nutritional Information Chatbot</h1>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 p-0">
                  <Avatar className="h-8 w-8 bg-primary/10 text-primary flex items-center justify-center">
                    <User className="h-4 w-4" />
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={navigateToSettings} className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Logout</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <div className="md:hidden text-center py-2 px-4 border-b">
          <h2 className="text-base font-medium text-foreground truncate">
            {getActiveConversation()?.title || "New conversation"}
          </h2>
        </div>

        {/* Chat container */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto relative" ref={scrollAreaRef}>
            {messages.length === 0 && !isLoading && (
              <div className="absolute inset-0 flex items-center justify-center p-4">
                <div className="max-w-md text-center p-6 rounded-lg bg-muted/30">
                  <Avatar className="h-16 w-16 mx-auto mb-4 bg-primary/10 text-primary flex items-center justify-center">
                    <Bot className="h-8 w-8" />
                  </Avatar>
                  <p className="text-lg font-medium mb-2">My name is Nic</p>
                  <p className="text-muted-foreground">
                    Your nutritional expert and assistant, what can I help you with today?
                  </p>
                </div>
              </div>
            )}

            <div className="p-2 sm:p-4">
              <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6">
                {error && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription className="flex flex-col gap-2">
                      <p>{error.message || "Failed to load response"}</p>
                      <Button variant="outline" size="sm" className="w-fit" onClick={() => reload()}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Retry
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}

                {messages.map((msg) => (
                  <Card
                    key={msg.id}
                    className={cn("border shadow-sm", msg.role === "user" ? "bg-muted/50" : "bg-background")}
                  >
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-start gap-3 sm:gap-4">
                        <Avatar
                          className={cn(
                            "h-8 w-8 flex items-center justify-center",
                            msg.role === "user" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                          )}
                        >
                          {msg.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium mb-1">
                            {msg.role === "user" ? "You" : "Assistant"}
                          </div>
                          <div className="whitespace-pre-wrap break-words text-sm sm:text-base">
                            {parseMessage(msg.content)}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {isLoading && (
                  <Card>
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-start gap-3 sm:gap-4">
                        <Avatar className="h-8 w-8 bg-muted text-muted-foreground flex items-center justify-center">
                          <Bot className="h-4 w-4" />
                        </Avatar>
                        <div className="flex items-center">
                          <div className="text-sm font-medium">Assistant</div>
                          <div className="ml-2 flex space-x-1">
                            <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                            <div className="w-2 h-2 rounded-full bg-primary animate-pulse delay-75"></div>
                            <div className="w-2 h-2 rounded-full bg-primary animate-pulse delay-150"></div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div ref={messagesEndRef} className="h-4" />
              </div>
            </div>
          </div>

          <div className="p-2 sm:p-4 border-t bg-background shrink-0">
            <div className="max-w-3xl mx-auto">
              <form onSubmit={handleMessageSubmit} className="flex flex-col gap-2">
                <div className="flex items-end gap-2">
                  <Textarea
                    ref={textareaRef}
                    placeholder="Message..."
                    className="flex-1 min-h-[60px] max-h-[200px] resize-none text-base sm:text-sm"
                    value={input}
                    onChange={handleTextareaChange}
                    onKeyDown={handleKeyPress}
                    disabled={isLoading}
                  />
                  <Button
                    type="submit"
                    size="icon"
                    className="h-10 w-10 sm:h-9 sm:w-9"
                    disabled={!input.trim() || isLoading}
                  >
                    <Send className="h-4 w-4" />
                    <span className="sr-only">Send</span>
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground text-center">
                  Press Enter to send, Shift+Enter for a new line
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
