import React, { useState } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Building2, MapPin, DollarSign, LayoutList, Ruler, Car, AlertCircle, FileJson, Loader2, Settings, Search, X, ExternalLink, Calendar, Map as MapIcon, List } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Standard Leaflet icons from CDN to avoid build/import issues
const markerIcon = 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png';
const markerShadow = 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

interface PostData {
  intent: "屋主自售" | "房仲銷售" | "買方求屋" | "無關/雜訊";
  title: string;
  url: string | null;
  date: string | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
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
  const [lifeCircle, setLifeCircle] = useState('全部');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [days, setDays] = useState(30);
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<PostData[] | null>(null);
  const [rawJson, setRawJson] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const lifeCircles = ['全部', '竹圍紅樹林生活圈', '淡水捷運站(站前)生活圈', '淡江大學(學府路)生活圈', '淡海新市鎮生活圈', '沙崙生活圈'];

  const handleSearch = async () => {
    if (!region.trim() && !keyword.trim() && lifeCircle === '全部') {
      setError('請選擇地區或輸入關鍵字');
      return;
    }
    
    setLoading(true);
    setError(null);
    setResults(null);
    setRawJson('');
    setCurrentPage(1);

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: `搜尋條件：
- 地區：${region}
- 生活圈：${lifeCircle === '全部' ? '淡水全區' : lifeCircle}
- 關鍵字：${keyword}
- 時間限制：過去 ${days} 天內

請使用 Google Search 深入搜尋相關的房地產貼文（包含 FB 社團、PTT、買房網站、Mobile01 等）。
目標：請盡可能找出至少 30 筆以上的獨立物件資訊。如果找不足 30 筆，請將能找到的所有相關物件列出。`,
        config: {
          tools: [{ googleSearch: {} }],
          systemInstruction: `這是一個房地產貼文搜尋與解析器。請嚴格遵循以下規則：
1. 根據使用者的搜尋條件（地點、生活圈、關鍵字、天數），使用 Google Search 搜尋大量的房地產貼文或物件資訊。
2. 目標搜尋量：請嘗試整理出 30 到 50 筆結果（如果搜尋結果足夠多）。
3. 意圖判斷：辨識貼文是「屋主自售」、「房仲銷售」、「買方求屋」或「無關/雜訊」。
4. 資料萃取：為每一個找到的物件，找出：url, date, location, price, layout, size, floor, parking 等。
5. 地理座標：請根據地點，預估物件的 latitude (緯度) 與 longitude (經度)，以便在地圖上顯示。
6. 嚴格格式：僅輸出合法的 JSON "陣列" 格式，不要有 Markdown。
`,
          responseMimeType: 'application/json'
        }
      });
      
      const text = response.text;
      if (text) {
        setRawJson(text);
        const parsed = JSON.parse(text);
        setResults(Array.isArray(parsed) ? parsed : []);
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

  const currentResults = results?.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage) || [];
  const totalPages = results ? Math.ceil(results.length / itemsPerPage) : 0;

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
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="w-full">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                搜尋地區
              </label>
              <input 
                type="text" 
                value={region}
                onChange={e => setRegion(e.target.value)}
                placeholder="例如：新北市淡水區"
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors text-sm"
              />
            </div>

            <div className="w-full">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                淡水生活圈
              </label>
              <select 
                value={lifeCircle}
                onChange={e => setLifeCircle(e.target.value)}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors text-sm appearance-none cursor-pointer"
              >
                {lifeCircles.map(circle => (
                  <option key={circle} value={circle}>{circle}</option>
                ))}
              </select>
            </div>
            
            <div className="w-full">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                附加關鍵字 <span className="text-gray-400 font-normal">(選填)</span>
              </label>
              <input 
                type="text" 
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                placeholder="例如：兩房、車位"
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors text-sm"
              />
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <button 
              onClick={handleSearch}
              disabled={loading}
              className="w-full md:w-auto py-3 px-8 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  搜尋中...
                </>
              ) : (
                <>
                  <Search size={18} />
                  立即搜尋
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
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-4">
                <h2 className="text-lg font-semibold flex items-center gap-2 text-gray-700">
                  <FileJson size={20} className="text-gray-500" />
                  搜尋結果 ({results.length} 筆)
                </h2>
                <div className="flex bg-gray-200 p-1 rounded-lg">
                  <button 
                    onClick={() => setViewMode('list')}
                    className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium transition-all ${viewMode === 'list' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                  >
                    <List size={14} />
                    清單
                  </button>
                  <button 
                    onClick={() => setViewMode('map')}
                    className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium transition-all ${viewMode === 'map' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                  >
                    <MapIcon size={14} />
                    地圖
                  </button>
                </div>
              </div>
              {totalPages > 1 && viewMode === 'list' && (
                <span className="text-sm font-medium text-gray-500">
                  第 {currentPage} / {totalPages} 頁
                </span>
              )}
            </div>
            
            {viewMode === 'list' ? (
              <div className="grid grid-cols-1 gap-6">
                {currentResults.map((post, i) => (
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
                        <p className="font-medium text-sm text-gray-800 line-clamp-1 text-ellipsis overflow-hidden">
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
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden h-[600px] relative z-0">
                <MapContainer 
                  center={[25.176, 121.442]} 
                  zoom={14} 
                  className="h-full w-full"
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  {results.filter(r => r.latitude && r.longitude).map((post, i) => (
                    <Marker key={i} position={[post.latitude!, post.longitude!]}>
                      <Popup>
                        <div className="p-1 max-w-[200px]">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase mb-1 inline-block ${intentColorMap[post.intent] || 'bg-gray-100'}`}>
                            {post.intent}
                          </span>
                          <h4 className="text-sm font-bold m-0 line-clamp-2 leading-tight">{post.title}</h4>
                          <p className="text-indigo-600 font-bold text-xs mt-1">
                            {post.price ? `${post.price.toLocaleString()} 萬` : '未提供價格'}
                          </p>
                          {post.url && (
                            <a 
                              href={post.url} 
                              target="_blank" 
                              rel="noreferrer"
                              className="text-indigo-500 text-[10px] mt-1 inline-block font-medium hover:underline"
                            >
                              查看詳情 →
                            </a>
                          )}
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              </div>
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 mt-8">
                <button 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                  上一頁
                </button>
                <div className="flex items-center gap-2">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum = i + 1;
                    if (totalPages > 5 && currentPage > 3) {
                      pageNum = currentPage - 3 + i + 1;
                      if (pageNum > totalPages) pageNum = totalPages - (4 - i);
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-10 h-10 rounded-lg text-sm font-medium transition-all ${currentPage === pageNum ? 'bg-indigo-600 text-white shadow-md' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 shadow-sm'}`}
                      >
                        {pageNum}
                      </button>
                    )
                  })}
                </div>
                <button 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                  下一頁
                </button>
              </div>
            )}

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
