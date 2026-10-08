package io.nahhasio.client

import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.*
import io.nahhasio.client.ui.NahhasioApp
import io.nahhasio.client.playback.MpvPlayer
import io.nahhasio.client.api.*
import io.nahhasio.client.generated.LoginRequest
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import kotlinx.serialization.decodeFromString
import io.nahhasio.client.ui.renderDesignPreview
import java.nio.file.Path
import java.awt.GraphicsEnvironment
import java.awt.Toolkit
import androidx.compose.ui.unit.DpSize

fun main(args: Array<String>) {
    if (args.size == 2 && args[0] == "--preview") {
        runBlocking { renderDesignPreview(Path.of(args[1])) }
        return
    }
    if (args.contentEquals(arrayOf("--smoke"))) {
        runBlocking {
            val credentials = Json.decodeFromString<LoginRequest>(readln())
            val api = NahhasioApi(System.getenv("NAHHASIO_CLIENT_SERVER") ?: "http://127.0.0.1:23103")
            api.login(credentials.email, credentials.password)
            try {
                val page = api.works(LibraryFilters())
                check(page.items.size <= 24)
                api.filters()
                page.items.firstOrNull()?.let { first ->
                    check(api.work(first.id).id == first.id)
                    first.poster?.let { check(api.artwork(it.url).isNotEmpty()) }
                }
                println("Client auth, catalog, detail, filters and artwork smoke passed (${page.total} works)")
            } finally { api.logout() }
        }
        return
    }
    application {
        Window(
            onCloseRequest = { MpvPlayer.close(); exitApplication() },
            title = "نحاسيو",
            state = rememberWindowState(size = initialDesktopSize()),
        ) {
            NahhasioApp()
        }
    }
}

private fun initialDesktopSize(): DpSize {
    val screen = GraphicsEnvironment.getLocalGraphicsEnvironment().defaultScreenDevice.defaultConfiguration
    val bounds = screen.bounds
    val insets = Toolkit.getDefaultToolkit().getScreenInsets(screen)
    val width = (bounds.width - insets.left - insets.right).coerceAtLeast(1)
    val height = (bounds.height - insets.top - insets.bottom).coerceAtLeast(1)
    return DpSize((width * .88).toInt().coerceAtMost(1400).coerceIn(minOf(480, width), width).dp,
        (height * .86).toInt().coerceAtMost(900).coerceIn(minOf(400, height), height).dp)
}
