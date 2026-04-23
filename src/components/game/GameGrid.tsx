import type { Game } from '../../api/games'
import { GameCard } from './GameCard'

interface GameGridProps {
  games: Game[]
  onSelect: (game: Game) => void
  onDownload?: (game: Game) => void
  downloadStartingIds?: ReadonlySet<string>
  onCancelDownloadStart?: (gameId: string) => void
  /** Grille plus serrée (paramètres utilisateur) */
  compact?: boolean
  /** Bibliothèque : colonnes plus larges, plus d’espace */
  comfortable?: boolean
}

export function GameGrid({
  games,
  onSelect,
  onDownload,
  downloadStartingIds,
  onCancelDownloadStart,
  compact,
  comfortable,
}: GameGridProps) {
  const min = compact ? '10rem' : comfortable ? '16.75rem' : '13.75rem'
  const gap = compact ? '0.75rem' : comfortable ? '1.35rem' : '1rem'
  return (
    <div className="grid"
      style={{ gap, gridTemplateColumns: `repeat(auto-fill, minmax(${min}, 1fr))` }}>
      {games.map(game => (
        <GameCard
          key={game.id}
          game={game}
          onSelect={onSelect}
          onDownload={onDownload}
          isDownloadStarting={Boolean(downloadStartingIds?.has(game.id))}
          onCancelDownloadStart={onCancelDownloadStart ? () => onCancelDownloadStart(game.id) : undefined}
        />
      ))}
    </div>
  )
}
