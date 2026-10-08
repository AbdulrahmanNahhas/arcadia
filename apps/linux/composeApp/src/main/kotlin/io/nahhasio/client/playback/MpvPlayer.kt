package io.nahhasio.client.playback

import java.awt.FileDialog
import java.awt.Frame
import java.nio.file.Files
import java.nio.file.Path
import java.net.StandardProtocolFamily
import java.net.UnixDomainSocketAddress
import java.nio.channels.SocketChannel
import java.nio.ByteBuffer
import kotlinx.serialization.json.*

/** External mpv owns decoding, subtitles, audio selection and fullscreen for this first slice. */
object MpvPlayer {
    private var process: Process? = null
    private var socketDirectory: Path? = null
    fun chooseVideoAndPlay(): Boolean {
        val dialog = FileDialog(null as Frame?, "اختر فيديو محلياً", FileDialog.LOAD)
        dialog.isVisible = true
        val file = dialog.file ?: return false
        play(Path.of(dialog.directory, file))
        return true
    }

    fun play(file: Path) {
        require(Files.isRegularFile(file) && Files.isReadable(file)) { "ملف الفيديو غير متاح" }
        close()
        val directory = Files.createTempDirectory("nahhasio-mpv-")
        socketDirectory = directory
        process = try { ProcessBuilder("mpv", "--player-operation-mode=pseudo-gui", "--sub-auto=fuzzy", "--input-ipc-server=${directory.resolve("ipc")}", "--", file.toAbsolutePath().toString())
            .redirectOutput(ProcessBuilder.Redirect.DISCARD)
            .redirectError(ProcessBuilder.Redirect.DISCARD)
            .start() } catch (error: Exception) { close(); throw error }
        process?.onExit()?.thenRun { runCatching { Files.deleteIfExists(directory.resolve("ipc")); Files.deleteIfExists(directory) } }
    }

    fun pause(paused: Boolean) = command(buildJsonArray { add("set_property"); add("pause"); add(paused) })
    fun addSubtitle(file: Path) {
        require(Files.isRegularFile(file))
        command(buildJsonArray { add("sub-add"); add(file.toAbsolutePath().toString()); add("select") })
    }
    private fun command(command: JsonArray) {
        val socket = socketDirectory?.resolve("ipc") ?: error("لا يوجد تشغيل نشط")
        SocketChannel.open(StandardProtocolFamily.UNIX).use { channel ->
            channel.connect(UnixDomainSocketAddress.of(socket))
            val bytes = ByteBuffer.wrap((buildJsonObject { put("command", command) }.toString() + "\n").toByteArray())
            while (bytes.hasRemaining()) channel.write(bytes)
        }
    }
    fun close() {
        process?.destroy()
        process = null
        socketDirectory?.let { directory ->
            runCatching { Files.deleteIfExists(directory.resolve("ipc")); Files.deleteIfExists(directory) }
        }
        socketDirectory = null
    }
}
