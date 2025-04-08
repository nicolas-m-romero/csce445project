"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Send, User, Bot, PanelRightOpen, PanelRightClose, Plus, AlertCircle, RefreshCw } from "lucide-react"
import { useChat } from "ai/react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { cn } from "@/lib/utils"

interface Conversation {
  id: string
  title: string
  messages: {
    id: string
    role: "user" | "assistant" | "system"
    content: string
    timestamp: Date
  }[]
  createdAt: Date
}

export default function ChatInterface() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConversation, setActiveConversation] = useState<string | null>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Get the active conversation
  const getActiveConversation = () => {
    return conversations.find((conv) => conv.id === activeConversation) || null
  }

  // Initialize AI chat for the current conversation
  const { messages, input, handleInputChange, handleSubmit, isLoading, setMessages, error, reload } = useChat({
    api: "/api/chat",
    onError: (error) => {
      console.error("Chat error:", error)
    },
    onFinish: (message) => {
      // Update the conversation with the assistant's response
      if (activeConversation) {
        const updatedConversations = conversations.map((conv) => {
          if (conv.id === activeConversation) {
            const updatedMessages = [...conv.messages]
            // Find if we already have this message (to avoid duplicates)
            const existingMsgIndex = updatedMessages.findIndex(
              (msg) => msg.content === message.content && msg.role === message.role,
            )

            if (existingMsgIndex === -1) {
              updatedMessages.push({
                id: Date.now().toString(),
                role: message.role,
                content: message.content,
                timestamp: new Date(),
              })
            }

            return {
              ...conv,
              messages: updatedMessages,
            }
          }
          return conv
        })

        setConversations(updatedConversations)
      }
    },
  })

  // Add this debugging code temporarily to your component
  useEffect(() => {
    console.log("Current messages:", messages)
  }, [messages])

  // Check if mobile on mount and handle sidebar visibility
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
  }, [messages, conversations, activeConversation])

  // Create a new conversation
  const createNewConversation = () => {
    const newConversation: Conversation = {
      id: Date.now().toString(),
      title: "New conversation",
      messages: [],
      createdAt: new Date(),
    }

    setConversations([newConversation, ...conversations])
    setActiveConversation(newConversation.id)
    setMessages([]) // Reset AI chat messages
  }

  // Initialize with a default conversation if none exists
  useEffect(() => {
    if (conversations.length === 0) {
      createNewConversation()
    }
  }, [])

  // Sync AI chat messages with the active conversation
  useEffect(() => {
    const currentConv = getActiveConversation()
    if (currentConv) {
      // Convert our conversation messages to the format expected by useChat
      setMessages(
        currentConv.messages.map((msg) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
        })),
      )
    }
  }, [activeConversation])

  // Make sure your handleMessageSubmit function is working correctly
  const handleMessageSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    console.log("Submitting message:", input)

    if (!input.trim() || !activeConversation) {
      console.log("Empty input or no active conversation")
      return
    }

    // Add user message to our conversation state
    const userMessage = {
      id: Date.now().toString(),
      role: "user" as const,
      content: input,
      timestamp: new Date(),
    }

    // Update conversation with user message and title if first message
    const updatedConversations = conversations.map((conv) => {
      if (conv.id === activeConversation) {
        // Update title if this is the first message
        const title =
          conv.messages.length === 0 ? input.substring(0, 30) + (input.length > 30 ? "..." : "") : conv.title

        return {
          ...conv,
          title,
          messages: [...conv.messages, userMessage],
        }
      }
      return conv
    })

    setConversations(updatedConversations)

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
    }

    // Submit to AI chat
    handleSubmit(e)
  }

  // Handle textarea resize
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    handleInputChange(e)

    // Auto resize textarea
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = "auto"
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
    }
  }

  // Handle key press (Enter to send, Shift+Enter for new line)
  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      const form = e.currentTarget.form
      if (form) form.requestSubmit()
    }
  }

  // Delete a conversation
  const deleteConversation = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()

    const updatedConversations = conversations.filter((conv) => conv.id !== id)
    setConversations(updatedConversations)

    // If we deleted the active conversation, set a new active one
    if (id === activeConversation) {
      setActiveConversation(updatedConversations.length > 0 ? updatedConversations[0].id : null)

      // If no conversations left, create a new one
      if (updatedConversations.length === 0) {
        createNewConversation()
      }
    }
  }

  // Render sidebar content (used in both desktop and mobile views)
  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <Button className="w-full justify-start gap-2" onClick={createNewConversation}>
          <Plus size={16} />
          New conversation
        </Button>
      </div>

      <ScrollArea className="flex-1">
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
      </ScrollArea>
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
        <header className="flex items-center px-4 h-14 border-b">
          <div className="flex items-center gap-2">
            {/* Mobile sidebar trigger */}
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

            {/* Desktop sidebar toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="hidden md:flex"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            >
              {isSidebarOpen ? <PanelRightClose size={20} /> : <PanelRightOpen size={20} />}
              <span className="sr-only">Toggle sidebar</span>
            </Button>
          </div>

          <h1 className="text-lg font-semibold ml-2 truncate">
            {getActiveConversation()?.title || "New conversation"}
          </h1>
        </header>

        {/* Messages */}
        <ScrollArea className="flex-1 p-2 sm:p-4">
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
                        "h-8 w-8",
                        msg.role === "user" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {msg.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                      <AvatarFallback>{msg.role === "user" ? "U" : "A"}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium mb-1">{msg.role === "user" ? "You" : "Assistant"}</div>
                      <div className="whitespace-pre-wrap break-words text-sm sm:text-base">{msg.content}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <Card>
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-start gap-3 sm:gap-4">
                    <Avatar className="h-8 w-8 bg-muted text-muted-foreground">
                      <Bot className="h-4 w-4" />
                      <AvatarFallback>A</AvatarFallback>
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

            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input area */}
        <div className="p-2 sm:p-4 border-t">
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
  )
}

