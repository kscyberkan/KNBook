import { Search } from 'lucide-react'

function SearchBox() {
  return (
    <div className="relative w-full max-w-2xl">
      <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
        <Search size={15} className="text-white/50" />
      </div>
      <input
        type="text"
        placeholder="ค้นหา..."
        className="w-full h-9 bg-white/15 hover:bg-white/20 focus:bg-white/25 rounded-full pl-9 pr-4 text-sm text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30 transition-all duration-200"
      />
    </div>
  )
}

export default SearchBox
