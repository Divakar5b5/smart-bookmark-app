"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"

export default function Home() {
  const [user, setUser] = useState(null)
  const [bookmarks, setBookmarks] = useState([])
  const [title, setTitle] = useState("")
  const [url, setUrl] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const getSession = async () => {
      const { data } = await supabase.auth.getSession()

      if (data.session) {
        const currentUser = data.session.user
        setUser(currentUser)
        fetchBookmarks(currentUser.id)
        subscribeToChanges(currentUser.id)
      }
      setLoading(false)
    }

    getSession()

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null)
        if (session?.user) {
          fetchBookmarks(session.user.id)
          subscribeToChanges(session.user.id)
        } else {
          setBookmarks([])
        }
        setLoading(false)
      }
    )

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [])

  const fetchBookmarks = async (userId) => {
    const { data, error } = await supabase
      .from("bookmarks")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    if (error) console.error("Error fetching:", error)
    else setBookmarks(data || [])
  }

  const subscribeToChanges = (userId) => {
    const channel = supabase
      .channel("realtime-bookmarks")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookmarks" },
        () => {
          fetchBookmarks(userId)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }

  const addBookmark = async () => {
    if (!title || !url || !user) return

    let finalUrl = url
    if (!/^https?:\/\//i.test(url)) {
      finalUrl = "https://" + url
    }

    const { data, error } = await supabase
      .from("bookmarks")
      .insert([
        {
          title,
          url: finalUrl,
          user_id: user.id
        }
      ])
      .select()

    if (error) {
      console.error("Error adding:", error.message)
      alert("Error adding: " + error.message)
    } else {
      if (data) {
        setBookmarks([data[0], ...bookmarks])
      }
      setTitle("")
      setUrl("")
    }
  }

  const deleteBookmark = async (id) => {
    const originalBookmarks = [...bookmarks]
    setBookmarks(bookmarks.filter((bookmark) => bookmark.id !== id))

    const { error } = await supabase
      .from("bookmarks")
      .delete()
      .eq("id", id)

    if (error) {
      console.error("Error deleting:", error.message)
      alert("Error deleting: " + error.message)
      setBookmarks(originalBookmarks)
    }
  }

  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin
      }
    })
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setBookmarks([])
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        Loading...
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center space-y-4 p-8 bg-white rounded-lg shadow-md">
          <h1 className="text-4xl font-bold mb-6 text-gray-800">
            Smart Bookmark App
          </h1>
          <button
            onClick={handleLogin}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium shadow-lg transition-colors w-full cursor-pointer"
          >
            Login with Google
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto mt-10 p-4 space-y-6">
      <div className="flex justify-between items-center border-b pb-4">
        <h1 className="text-3xl font-bold text-gray-800">
          Smart Bookmarks 🚀
        </h1>
        <div className="text-right">
          <p className="text-xs text-gray-500">Logged in as</p>
          <p className="text-sm font-medium text-gray-700">
            {user.email}
          </p>
        </div>
      </div>

      <div className="flex gap-2 flex-col sm:flex-row bg-gray-50 p-4 rounded-lg border">
        <input
          placeholder="Title (e.g. My Portfolio)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="border p-2 rounded flex-1 focus:ring-2 focus:ring-blue-500 outline-none"
        />
        <input
          placeholder="URL (e.g. google.com)"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="border p-2 rounded flex-1 focus:ring-2 focus:ring-blue-500 outline-none"
        />
        <button
          onClick={addBookmark}
          disabled={!title || !url}
          className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-6 py-2 rounded font-medium transition-colors cursor-pointer"
        >
          Add
        </button>
      </div>

      <div className="space-y-3">
        {bookmarks.length === 0 ? (
          <div className="text-center py-10 text-gray-500 bg-gray-50 rounded border border-dashed">
            No bookmarks yet. Add one above!
          </div>
        ) : (
          bookmarks.map((bookmark) => (
            <div
              key={bookmark.id}
              className="flex justify-between items-center border p-3 rounded hover:bg-gray-50 transition-colors shadow-sm bg-white"
            >
              <div className="flex flex-col overflow-hidden">
                <a
                  href={bookmark.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 font-medium hover:underline text-lg truncate"
                >
                  {bookmark.title}
                </a>
                <span className="text-xs text-gray-400 truncate max-w-md">
                  {bookmark.url}
                </span>
              </div>
              <button
                onClick={() => deleteBookmark(bookmark.id)}
                className="ml-4 text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1 rounded transition-colors text-sm font-semibold whitespace-nowrap cursor-pointer"
              >
                Delete
              </button>
            </div>
          ))
        )}
      </div>

      <div className="pt-6 border-t flex justify-end">
        <button
          onClick={handleLogout}
          className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded text-sm transition-colors cursor-pointer"
        >
          Logout
        </button>
      </div>
    </div>
  )
}
