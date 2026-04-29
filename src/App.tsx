import React, { useState } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Building2, MapPin, DollarSign, LayoutList, Ruler, Car, AlertCircle, FileJson, Loader2, Settings, Search, X, ExternalLink, Calendar } from 'lucide-react';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

interface PostData {
  intent: "屋主自售" | "房仲銷售" | "買方求屋" | "無關/雜訊";
  title: string;
  url: string | null;
  date: string | null;
  location: string | null;
  price: number | null;
  layout: {
    rooms: number | null;
    livingRooms: number | null;
    bathrooms: number | null;
    balconies: number | null;
  } | null;
  size: {
    total: number | null;
    main: number | null;
  } | null;
  floor: {
    current: number | null;
    total: number | null;
  } | null;
  parking: string | null;
}

export default function App() {
  const [region, setRegion] = useState('新北市淡水區');
  const [keyword, setKeyword] = useState('');
  const [days, setDays] = useState(30);
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<PostData[] | null>(null);
  const [rawJson, setRawJson] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!region.trim() && !keyword.trim()) {
      setError('請至少輸入地區或關鍵字');
      return;
    }
    
    setLoading(true);
    setError(null);
    setResults(null);
    setRawJson('');

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: `搜尋條件：
- 地區：${region}
- 關鍵字：${keyword}
- 時間限制：過去 ${days} 天內

請使用 Google Search 搜尋相關的房地產貼文，並整理出 3 到 5 筆最新的搜尋結果。`,
        config: {
          tools: [{ googleSearch: {} }],
          systemInstruction: `這是一個房地產貼文搜尋與解析器。請嚴格遵循以下規則：
1. 根據使用者的搜尋條件（地點、關鍵字、天數），使用 Google Search 搜尋最新的房地產貼文或物件資訊。
2. 意圖判斷：辨識貼文是「屋主自售」、「房仲銷售」、「買方求屋」或「無關/雜訊（如純討論、廣告詐騙）」。（大部分賣房網站都屬於房仲銷售或屋主自售）
3. 資料萃取：為每一個找到的物件，盡可能找出以下欄位：
   - 來源網址 url (必須是真實的搜尋結果連結，非常重要)
   - 發文日期 date (如 2024-05-01 或 摘要日期)
   - 地點（縣市、行政區、路段或社區名稱）
   - 價格（轉換為阿拉伯數字，單位為「萬」新台幣）
   - 格局（房、廳、衛浴、陽台數量）
   - 坪數（建坪、主建物坪數）
   - 樓層/總樓層
   - 車位（有無、類型）
4. 缺失值處理：如果貼文中沒有提及某項資訊，該欄位請填寫 null，不要自行猜測。
5. 嚴格格式：無論內容為何，你「必須」僅輸出合法的 JSON "陣列" 格式。

JSON Schema:
[
  {
    "intent": "屋主自售" | "房仲銷售" | "買方求屋" | "無關/雜訊",
    "title": "貼文標題或物件名稱",
    "url": "真實連結 URL" | null,
    "date": "發文或更新日期" | null,
    "location": "地點" | null,
    "price": 1200,
    "layout": { "rooms": 3, "livingRooms": 2, "bathrooms": 2, "balconies": 1 } | null,
    "size": { "total": 35.5, "main": 25.0 } | null,
    "floor": { "current": 5, "total": 12 } | null,
    "parking": "平面車位" | null
  }
]`,
          responseMimeType: 'application/json'
        }
      });
      
      const text = response.text;
      if (text) {
        setRawJson(text);
        setResults(JSON.parse(text));
      } else {
        throw new Error('搜尋失敗，沒有回傳內容');
      }
      
    } catch (err: any) {
      console.error(err);
      setError(err.message || '發生錯誤');
    } finally {
      setLoading(false);
    }
  };

  const intentColorMap: Record<string, string> = {
    "屋主自售": "bg-emerald-100 text-emerald-800",
    "房仲銷售": "bg-blue-100 text-blue-800",
    "買方求屋": "bg-violet-100 text-violet-800",
    "無關/雜訊": "bg-gray-100 text-gray-800",
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col p-4 font-sans text-gray-900 pb-20 relative">
      <div className="w-full max-w-5xl mx-auto space-y-6">
        {/* Header & Search Bar */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-600 text-white p-2 rounded-lg">
                <Search size={24} />
              </div>
              <h1 className="text-xl font-bold">房地產貼文搜尋系統</h1>
            </div>
            <button 
              onClick={() => setShowSettings(true)}
              className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
              title="系統設定"
            >
              <Settings size={22} />
            </button>
          </div>
          
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1 w-full">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                搜尋地區
              </label>
              <input 
                type="text" 
                value={region}
                onChange={e => setRegion(e.target.value)}
                placeholder="例如：新北市淡水區"
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
              />
            </div>
            
            <div className="flex-1 w-full">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                附加關鍵字 <span className="text-gray-400 font-normal">(選填)</span>
              </label>
              <input 
                type="text" 
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                placeholder="例如：屋主自售、兩房"
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
              />
            </div>
            
            <button 
              onClick={handleSearch}
              disabled={loading}
              className="w-full md:w-auto py-3 px-6 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  搜尋中...
                </>
              ) : (
                <>
                  <Search size={18} />
                  開始搜尋
                </>
              )}
            </button>
          </div>
          
          {error && (
            <div className="mt-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <p>{error}</p>
            </div>
          )}
        </div>

        {/* Results Area */}
        {results && !loading && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2 text-gray-700 px-1">
              <FileJson size={20} className="text-gray-500" />
              搜尋結果 ({results.length} 筆)
            </h2>
            
            <div className="grid grid-cols-1 gap-6">
              {results.map((post, i) => (
                <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 animate-in fade-in zoom-in-95 duration-300">
                  <div className="flex items-start justify-between flex-wrap gap-2 mb-2">
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${intentColorMap[post.intent] || 'bg-gray-100'}`}>
                      {post.intent}
                    </span>
                    {post.url && (
                      <a 
                        href={post.url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1 rounded-full transition-colors"
                      >
                        <ExternalLink size={14} />
                        查看來源
                      </a>
                    )}
                  </div>
                  
                  <h3 className="text-xl font-bold text-gray-900 mb-2 leading-tight">
                    {post.title}
                  </h3>
                  
                  {post.date && (
                    <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-5">
                      <Calendar size={14} />
                      發文日期：{post.date}
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                      <div className="flex items-center gap-2 text-gray-500 mb-1.5">
                        <DollarSign size={15} />
                        <span className="text-xs font-semibold uppercase">價格</span>
                      </div>
                      <p className="font-semibold text-indigo-600">
                        {post.price !== null ? (
                          <>{post.price.toLocaleString()} <span className="text-sm font-normal text-gray-500">萬</span></>
                        ) : <span className="text-gray-400 italic text-sm font-normal">未提供</span>}
                      </p>
                    </div>

                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                      <div className="flex items-center gap-2 text-gray-500 mb-1.5">
                        <MapPin size={15} />
                        <span className="text-xs font-semibold uppercase">地點</span>
                      </div>
                      <p className="font-medium text-sm text-gray-800">
                        {post.location || <span className="text-gray-400 italic">未提供</span>}
                      </p>
                    </div>

                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                      <div className="flex items-center gap-2 text-gray-500 mb-1.5">
                        <LayoutList size={15} />
                        <span className="text-xs font-semibold uppercase">格局</span>
                      </div>
                      <p className="font-medium text-sm text-gray-800">
                        {post.layout ? (
                          <>{post.layout.rooms ?? '-'}房{post.layout.livingRooms ?? '-'}廳{post.layout.bathrooms ?? '-'}衛</>
                        ) : <span className="text-gray-400 italic">未提供</span>}
                      </p>
                    </div>

                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                      <div className="flex items-center gap-2 text-gray-500 mb-1.5">
                        <Ruler size={15} />
                        <span className="text-xs font-semibold uppercase">坪數建坪</span>
                      </div>
                      <div className="font-medium text-sm text-gray-800">
                        {post.size?.total ? (
                          <>{post.size.total} <span className="text-gray-500 font-normal">坪</span></>
                        ) : <span className="text-gray-400 italic">未提供</span>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Raw JSON Toggle */}
            <details className="group !mt-8">
              <summary className="cursor-pointer text-sm font-medium text-gray-500 hover:text-gray-700 flex items-center justify-center">
                檢視原始 JSON 輸出
              </summary>
              <div className="mt-4 bg-slate-900 rounded-2xl shadow-sm border border-slate-800 p-6 overflow-hidden">
                <pre className="text-xs text-emerald-400 overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed">
                  {rawJson}
                </pre>
              </div>
            </details>
          </div>
        )}

        {!results && !loading && !error && (
          <div className="h-64 flex flex-col items-center justify-center text-gray-400 bg-white border border-gray-200 border-dashed rounded-2xl">
            <Search size={48} className="mb-4 opacity-20" />
            <p>輸入條件並點擊開始搜尋，即可自動查找網路資訊</p>
          </div>
        )}

        {loading && (
          <div className="h-64 flex flex-col items-center justify-center text-indigo-500 bg-white border border-gray-200 rounded-2xl shadow-sm">
            <Loader2 size={40} className="mb-4 animate-spin" />
            <p className="font-medium">AI 正在網路上為您搜尋符合條件的資料...</p>
            <p className="text-sm text-gray-400 mt-2">這可能需要幾秒鐘的時間</p>
          </div>
        )}
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2">
                <Settings size={18} className="text-gray-500" />
                系統設定
              </h3>
              <button 
                onClick={() => setShowSettings(false)}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  搜尋貼文範圍 (天內)
                </label>
                <div className="flex items-center gap-3">
                  <input 
                    type="range" 
                    min="1" 
                    max="90" 
                    value={days}
                    onChange={e => setDays(Number(e.target.value))}
                    className="flex-1 accent-indigo-600"
                  />
                  <div className="w-16 text-center py-1 px-2 bg-indigo-50 text-indigo-700 font-bold rounded-lg text-sm border border-indigo-100">
                    {days} 天
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  設定 AI 在網路上搜尋過去幾天內的資訊。天數越長找到的資料越多，但可能包含已售出或過期的貼文。
                </p>
              </div>
            </div>
            
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button 
                onClick={() => setShowSettings(false)}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
              >
                完成
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
