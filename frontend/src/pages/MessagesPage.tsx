import { useEffect, useState, useRef } from 'react';
import { api } from '@/api/client';
import { useAuthStore } from '@/store/auth.store';
import { Send, User, MessageSquare, Loader2, Search } from 'lucide-react';

export function MessagesPage() {
  const { user } = useAuthStore();
  const [contacts, setContacts] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [loadingContacts, setLoadingContacts] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollInterval = useRef<any>(null);
  const searchTimeoutRef = useRef<any>(null);

  useEffect(() => {
    fetchContacts();
    return () => clearInterval(pollInterval.current);
  }, []);

  useEffect(() => {
    if (selectedUser) {
      fetchMessages();
      clearInterval(pollInterval.current);
      pollInterval.current = setInterval(fetchMessages, 3000);
    }
    return () => clearInterval(pollInterval.current);
  }, [selectedUser]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchContacts = async () => {
    try {
      const res = await api.get('/messages/contacts');
      setContacts(res.data.data);
    } catch (e) {
      console.error('Failed to fetch contacts');
    }
    setLoadingContacts(false);
  };

  const fetchMessages = async () => {
    if (!selectedUser) return;
    try {
      const res = await api.get(`/messages/${selectedUser.id}`);
      setMessages(res.data.data);
    } catch (e) {
      console.error('Failed to fetch messages');
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await api.get(`/messages/search?q=${encodeURIComponent(query.trim())}`);
        setSearchResults(res.data.data || []);
      } catch (e) {
        console.error('Search failed', e);
      }
    }, 500);
  };

  const selectContact = (contact: any) => {
    setSelectedUser(contact);
    setSearchQuery('');
    setIsSearching(false);
    if (!contacts.find(c => c.id === contact.id)) {
      setContacts(prev => [contact, ...prev]);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !selectedUser) return;
    const content = inputText;
    setInputText('');
    
    try {
      const res = await api.post('/messages', {
        receiverId: selectedUser.id,
        content
      });
      setMessages([...messages, res.data.data]);
      scrollToBottom();
    } catch (e) {
      console.error('Failed to send message');
      setInputText(content); // restore on fail
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const displayList = isSearching ? searchResults : contacts;

  return (
    <div className="h-[calc(100vh-100px)] flex gap-4">
      {/* Contacts Sidebar */}
      <div className="w-1/3 glass-panel rounded-2xl flex flex-col overflow-hidden">
        <div className="p-4 border-b border-white/10">
          <h2 className="text-lg font-bold text-primary flex items-center gap-2 mb-4">
            <MessageSquare size={20} className="text-accent" />
            Мессенджер
          </h2>
          <div className="relative">
            <input 
              type="text" 
              placeholder="Поиск пользователей..." 
              value={searchQuery}
              onChange={e => handleSearch(e.target.value)}
              className="w-full input-glass rounded-xl px-4 py-2.5 text-sm pl-10 outline-none"
            />
            <Search size={16} className="absolute left-3 top-3 text-tertiary" />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {loadingContacts ? (
            <div className="flex justify-center p-6"><Loader2 className="animate-spin text-accent" /></div>
          ) : isSearching && searchResults.length === 0 ? (
            <div className="p-6 text-center text-tertiary text-sm">Ничего не найдено</div>
          ) : !isSearching && contacts.length === 0 ? (
            <div className="p-6 text-center text-tertiary text-sm">У вас пока нет переписок. Найдите кого-нибудь через поиск!</div>
          ) : (
            displayList.map(c => (
              <div 
                key={c.id} 
                onClick={() => selectContact(c)}
                className={`p-4 flex items-center gap-3 cursor-pointer transition-colors border-l-4 ${selectedUser?.id === c.id ? 'bg-white/10 border-accent' : 'border-transparent hover:bg-white/5'}`}
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent/20 to-purple-500/20 flex items-center justify-center text-accent font-bold">
                  {c.firstName?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-primary truncate">{c.firstName} {c.lastName}</div>
                  {isSearching && <div className="text-xs text-tertiary truncate">{c.role === 'TEACHER' ? 'Преподаватель' : c.role === 'STUDENT' ? 'Студент' : c.role}</div>}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 glass-panel rounded-2xl flex flex-col overflow-hidden">
        {selectedUser ? (
          <>
            <div className="p-4 border-b border-white/10 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent/20 to-purple-500/20 flex items-center justify-center text-accent font-bold">
                {selectedUser.firstName?.[0]}
              </div>
              <div className="font-bold text-primary">{selectedUser.firstName} {selectedUser.lastName}</div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4 flex flex-col">
              {messages.map(m => {
                const isMe = m.senderId === user?.id;
                return (
                  <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div 
                      className={`max-w-[70%] px-4 py-2 rounded-2xl ${
                        isMe 
                          ? 'bg-accent text-white rounded-tr-sm' 
                          : 'bg-white/10 text-primary rounded-tl-sm'
                      }`}
                    >
                      <p className="whitespace-pre-wrap text-sm">{m.content}</p>
                      <p className={`text-[10px] mt-1 text-right ${isMe ? 'text-white/70' : 'text-tertiary'}`}>
                        {new Date(m.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
            
            <div className="p-4 border-t border-white/10">
              <form onSubmit={sendMessage} className="flex gap-2">
                <input 
                  type="text" 
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  placeholder="Введите сообщение..." 
                  className="input-glass flex-1 rounded-xl px-4"
                />
                <button 
                  type="submit" 
                  disabled={!inputText.trim()}
                  className="bg-accent text-white w-12 h-12 rounded-xl flex items-center justify-center disabled:opacity-50 hover:opacity-90 transition-opacity"
                >
                  <Send size={18} />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-tertiary">
            <MessageSquare size={64} className="opacity-20 mb-4" />
            <p>Выберите контакт для начала общения</p>
          </div>
        )}
      </div>
    </div>
  );
}

