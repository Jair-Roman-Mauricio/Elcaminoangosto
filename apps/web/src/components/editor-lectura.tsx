import { useEffect, useRef } from 'react'
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import { Markdown } from 'tiptap-markdown'
import { cn } from '@elcamino/ui/static'
import { subirImagenPublica } from '../lib/image-upload'
import './editor-lectura.css'

export interface EditorLecturaProps {
  /** Contenido en Markdown. */
  value?: string
  /** Devuelve el Markdown en cada cambio (solo en modo edición). */
  onChange?: (markdown: string) => void
  /** false = solo lectura (vista del alumno). */
  editable?: boolean
  className?: string
}

/** Acceso al Markdown que expone tiptap-markdown (no tipado en el Storage). */
function obtenerMarkdown(editor: Editor): string {
  const storage = editor.storage as { markdown?: { getMarkdown: () => string } }
  return storage.markdown?.getMarkdown() ?? ''
}

/**
 * Editor de texto enriquecido «tipo Word» (WYSIWYG) que guarda **Markdown**.
 * El mentor escribe con formato visible (negrita, títulos, listas) sin ver las
 * marcas; el contenido se persiste como `.md`. El mismo componente, en modo
 * solo lectura, renderiza esa lectura para el alumno.
 *
 * Basado en TipTap. No permite HTML crudo (`html: false`): el esquema de
 * ProseMirror actúa de saneado anti-XSS.
 */
export function EditorLectura({
  value = '',
  onChange,
  editable = true,
  className,
}: EditorLecturaProps) {
  const editor = useEditor({
    immediatelyRender: false,
    editable,
    extensions: [
      StarterKit,
      Image.configure({ inline: false, HTMLAttributes: { class: 'editor-lectura__img' } }),
      Markdown.configure({ html: false, breaks: true }),
    ],
    content: value,
    onUpdate: ({ editor }) => onChange?.(obtenerMarkdown(editor)),
  })

  // Modo lectura: si cambia el contenido externo (otra lección), refléjalo.
  useEffect(() => {
    if (!editor || editable) return
    const actual = obtenerMarkdown(editor)
    if (value !== actual) editor.commands.setContent(value)
  }, [editor, editable, value])

  useEffect(() => {
    editor?.setEditable(editable)
  }, [editor, editable])

  if (!editor) return null

  return (
    <div className={cn('editor-lectura', !editable && 'editor-lectura--solo-lectura', className)}>
      {editable && <BarraFormato editor={editor} />}
      <div className="editor-lectura__scroll">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}

/** Barra de herramientas de formato. Solo acciones con equivalente en Markdown. */
function BarraFormato({ editor }: { editor: Editor }) {
  const estado = useEditorState({
    editor,
    selector: ({ editor }) => ({
      puedeDeshacer: editor.can().undo(),
      puedeRehacer: editor.can().redo(),
      parrafo: editor.isActive('paragraph'),
      bold: editor.isActive('bold'),
      italic: editor.isActive('italic'),
      strike: editor.isActive('strike'),
      code: editor.isActive('code'),
      h2: editor.isActive('heading', { level: 2 }),
      h3: editor.isActive('heading', { level: 3 }),
      bullet: editor.isActive('bulletList'),
      ordered: editor.isActive('orderedList'),
      quote: editor.isActive('blockquote'),
    }),
  })

  return (
    <div className="editor-lectura__toolbar" role="toolbar" aria-label="Formato de texto">
      <BotonFormato etiqueta="Deshacer" disabled={!estado.puedeDeshacer} onClick={() => editor.chain().focus().undo().run()}>
        ↺
      </BotonFormato>
      <BotonFormato etiqueta="Rehacer" disabled={!estado.puedeRehacer} onClick={() => editor.chain().focus().redo().run()}>
        ↻
      </BotonFormato>
      <span className="editor-lectura__sep" aria-hidden="true" />
      <BotonFormato activo={estado.parrafo} etiqueta="Texto normal" onClick={() => editor.chain().focus().setParagraph().run()}>
        ¶
      </BotonFormato>
      <BotonFormato activo={estado.h2} etiqueta="Título" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        <span className="editor-lectura__btn-lg">T</span>
      </BotonFormato>
      <BotonFormato activo={estado.h3} etiqueta="Subtítulo" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
        <span className="editor-lectura__btn-sm">T</span>
      </BotonFormato>
      <span className="editor-lectura__sep" aria-hidden="true" />
      <BotonFormato activo={estado.bold} etiqueta="Negrita" onClick={() => editor.chain().focus().toggleBold().run()}>
        <strong>B</strong>
      </BotonFormato>
      <BotonFormato activo={estado.italic} etiqueta="Cursiva" onClick={() => editor.chain().focus().toggleItalic().run()}>
        <em>I</em>
      </BotonFormato>
      <BotonFormato activo={estado.strike} etiqueta="Tachado" onClick={() => editor.chain().focus().toggleStrike().run()}>
        <s>S</s>
      </BotonFormato>
      <BotonFormato activo={estado.code} etiqueta="Código" onClick={() => editor.chain().focus().toggleCode().run()}>
        {'</>'}
      </BotonFormato>
      <span className="editor-lectura__sep" aria-hidden="true" />
      <BotonFormato activo={estado.bullet} etiqueta="Lista" onClick={() => editor.chain().focus().toggleBulletList().run()}>
        •
      </BotonFormato>
      <BotonFormato activo={estado.ordered} etiqueta="Lista numerada" onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        1.
      </BotonFormato>
      <BotonFormato activo={estado.quote} etiqueta="Cita" onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        &rdquo;
      </BotonFormato>
      <BotonFormato etiqueta="Línea divisoria" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
        —
      </BotonFormato>
      <span className="editor-lectura__sep" aria-hidden="true" />
      <BotonImagen editor={editor} />
    </div>
  )
}

/** Inserta una imagen: la sube a un bucket público y la coloca en el documento. */
function BotonImagen({ editor }: { editor: Editor }) {
  const input = useRef<HTMLInputElement>(null)

  const elegir = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // permite volver a elegir el mismo archivo
    if (!file) return
    try {
      const url = await subirImagenPublica(file)
      editor.chain().focus().setImage({ src: url, alt: file.name }).run()
    } catch {
      // La subida falló (permiso, tamaño): el editor sigue usable.
    }
  }

  return (
    <>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={elegir} />
      <BotonFormato etiqueta="Insertar imagen" onClick={() => input.current?.click()}>
        🖼
      </BotonFormato>
    </>
  )
}

function BotonFormato({
  activo = false,
  etiqueta,
  onClick,
  disabled = false,
  children,
}: {
  activo?: boolean
  etiqueta: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={etiqueta}
      aria-pressed={activo}
      title={etiqueta}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()} // no perder el foco/selección del editor
      onClick={onClick}
      className={cn('editor-lectura__btn', activo && 'editor-lectura__btn--activo')}
    >
      {children}
    </button>
  )
}
