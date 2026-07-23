import type { CSSProperties } from 'react'

type AlbumSleeveProps = {
  artwork: string
  discArtwork: string
  discColor: string
  title: string
  opening: boolean
  disabled?: boolean
  onOpen: () => void
}

/** Funda 2D con dos vinilos; al abrir, los discos salen de forma escalonada. */
export function AlbumSleeve({ artwork, discArtwork, discColor, title, opening, disabled = false, onOpen }: AlbumSleeveProps) {
  return (
    <button
      type="button"
      className={`album-sleeve${opening ? ' is-opening' : ''}`}
      onClick={onOpen}
      disabled={disabled}
      aria-label={`Abrir categoría ${title}`}
      aria-busy={opening}
    >
      <span className="album-sleeve__vinyl" style={{ '--vinyl-color': discColor } as CSSProperties} aria-hidden="true">
        <span className="album-sleeve__label">
          <img src={discArtwork} alt="" />
        </span>
      </span>
      <span className="album-sleeve__cover">
        <img src={artwork} alt="" />
        <span className="album-sleeve__shine" aria-hidden="true" />
      </span>
    </button>
  )
}
