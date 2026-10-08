package io.nahhasio.client.ui

import androidx.compose.foundation.layout.*
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.ImageComposeScene
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.input.key.*
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.*
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.LayoutDirection
import io.nahhasio.client.api.*
import io.nahhasio.client.auth.LoginScreen
import io.nahhasio.client.generated.LoginRequest
import io.nahhasio.client.library.*
import kotlinx.coroutines.*
import kotlinx.coroutines.swing.Swing
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.json.Json
import java.nio.file.Files
import java.nio.file.Path

/** App-owned offscreen compositions and semantics checks, using actual authorized catalog data. */
@OptIn(androidx.compose.ui.ExperimentalComposeUiApi::class, androidx.compose.ui.InternalComposeUiApi::class)
suspend fun renderDesignPreview(output: Path) {
    val credentials = Json.decodeFromString<LoginRequest>(readln())
    val api = NahhasioApi(System.getenv("NAHHASIO_CLIENT_SERVER") ?: "http://127.0.0.1:23103")
    val name = api.login(credentials.email, credentials.password)
    try {
        val page = api.works(LibraryFilters())
        val arcane = api.works(LibraryFilters(query = "Arcane")).items.firstOrNull() ?: error("Arcane missing from catalog")
        val work = api.work(arcane.id)
        check(normalizeYearInput("٢٠٢١") == "2021")
        check(displayEpisodeNumber("1.00") == "1" && displayEpisodeNumber("100") == "100" && displayEpisodeNumber("1.5") == "1.5")
        val directory = output.toAbsolutePath().parent
        Files.createDirectories(directory)
        withContext(Dispatchers.Swing) {
            for (width in listOf(1440, 1024, 640, 480)) {
                val libraryScene = ImageComposeScene(width, 600, Density(1f), LayoutDirection.Rtl, Dispatchers.Swing) {
                    DesktopTheme { CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
                        Surface(Modifier.fillMaxSize()) { DesktopShell(name, api.baseUrl, {}) { LibraryScreen(api, LibraryFilters(), page, false, {}, {}) } }
                    } }
                }
                try { frames(libraryScene); save(libraryScene, directory.resolve("linux-library-$width.png")) } finally { libraryScene.close() }
                var actualTab = -1
                var actualEpisode: String? = null
                val workScene = ImageComposeScene(width, 600, Density(1f), LayoutDirection.Rtl, Dispatchers.Swing) {
                    DesktopTheme { CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
                        Surface(Modifier.fillMaxSize()) { DesktopShell(name, api.baseUrl, {}, immersive = true) {
                            WorkScreen(api, work, onTabSelected = { actualTab = it }, onEpisodeSelected = { actualEpisode = it })
                        } }
                    } }
                }
                try {
                    frames(workScene)
                    save(workScene, directory.resolve("linux-arcane-$width.png"))
                    scroll(workScene, 420f); frames(workScene, 20)
                    check(clickText(workScene, workTabs[1])) { "Episode tab not reachable at $width" }
                    frames(workScene, 20)
                    check(actualTab == 1) { "Episode tab failed at $width" }
                    scroll(workScene, 360f); frames(workScene, 20)
                    save(workScene, directory.resolve("linux-arcane-episodes-overview-$width.png"))
                    val firstEpisode = work.installments.firstOrNull()?.episodes?.firstOrNull()
                    if (firstEpisode != null) {
                        check(clickText(workScene, "الحلقة ${displayEpisodeNumber(firstEpisode.number)}")) { "Episode card unreachable at $width" }
                        frames(workScene, 15)
                        check(actualEpisode == firstEpisode.id) { "Episode selection failed at $width" }
                    }
                    save(workScene, directory.resolve("linux-arcane-episodes-$width.png"))
                    // Tab navigation uses the same live state and semantic click handlers as the normal app.
                    scroll(workScene, -1000f); frames(workScene, 20)
                    scroll(workScene, 420f); frames(workScene, 20)
                    for (index in listOf(2, 3, 4, 5, 0)) {
                        // Horizontal tabs can overflow compact windows; semantic action remains reachable.
                        check(clickText(workScene, workTabs[index])) { "Tab $index missing at $width" }
                        frames(workScene, 15)
                        check(actualTab == index)
                        if (width == 1440 || width == 480) save(workScene, directory.resolve("linux-arcane-tab-$index-$width.png"))
                    }
                    val focusNode = workScene.semanticsOwners.flatMap { nodes(it.rootSemanticsNode) }.firstOrNull {
                        it.config.getOrNull(SemanticsProperties.Text)?.any { text -> text.text == workTabs[0] } == true
                            && it.config.getOrNull(SemanticsActions.RequestFocus) != null
                    }
                    check(focusNode?.config?.getOrNull(SemanticsActions.RequestFocus)?.action?.invoke() == true)
                    frames(workScene, 5)
                    workScene.sendKeyEvent(KeyEvent(key = Key.DirectionLeft, type = KeyEventType.KeyDown))
                    frames(workScene, 10)
                    check(actualTab == 1) { "RTL keyboard tab navigation failed at $width" }
                } finally { workScene.close() }
            }
            for (tab in listOf(0, 1, 2)) {
                val desktopScene = ImageComposeScene(1440, 900, Density(1f), LayoutDirection.Rtl, Dispatchers.Swing) {
                    DesktopTheme { CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
                        Surface(Modifier.fillMaxSize()) { DesktopShell(name, api.baseUrl, {}, immersive = true) { WorkScreen(api, work, initialTab = tab) } }
                    } }
                }
                try {
                    frames(desktopScene)
                    if (tab != 0) { scroll(desktopScene, 420f); frames(desktopScene, 20) }
                    save(desktopScene, directory.resolve(listOf("linux-arcane-desktop.png", "linux-arcane-episodes-desktop.png", "linux-arcane-risks-desktop.png")[tab]))
                } finally { desktopScene.close() }
            }
            val loginScene = ImageComposeScene(480, 700, Density(1f), LayoutDirection.Rtl, Dispatchers.Swing) {
                DesktopTheme { CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
                    Surface(Modifier.fillMaxSize()) { Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { LoginScreen(false, null) { _, _, _ -> } } }
                } }
            }
            try { frames(loginScene, 10); save(loginScene, directory.resolve("linux-login.png")) } finally { loginScene.close() }
        }
        println("Responsive previews and tab/episode selection passed at1440/1024/640/480; ${page.total} real works")
    } finally { api.logout() }
}

@OptIn(androidx.compose.ui.ExperimentalComposeUiApi::class)
private suspend fun frames(scene: ImageComposeScene, count: Int = 70) {
    repeat(count) { scene.render(System.nanoTime()).close(); delay(20) }
}
@OptIn(androidx.compose.ui.ExperimentalComposeUiApi::class)
private fun save(scene: ImageComposeScene, path: Path) {
    scene.render(System.nanoTime()).use { image -> image.encodeToData()?.use { Files.write(path, it.bytes) } }
}
private fun nodes(root: SemanticsNode): List<SemanticsNode> = listOf(root) + root.children.flatMap(::nodes)
@OptIn(androidx.compose.ui.ExperimentalComposeUiApi::class)
private fun clickText(scene: ImageComposeScene, label: String): Boolean {
    val node = scene.semanticsOwners.flatMap { nodes(it.rootSemanticsNode) }.firstOrNull {
        it.config.getOrNull(SemanticsProperties.Text)?.any { text -> text.text == label } == true && it.config.getOrNull(SemanticsActions.OnClick) != null
    }
    return node?.config?.getOrNull(SemanticsActions.OnClick)?.action?.invoke() == true
}
@OptIn(androidx.compose.ui.ExperimentalComposeUiApi::class)
private fun scroll(scene: ImageComposeScene, delta: Float) {
    val node = scene.semanticsOwners.flatMap { nodes(it.rootSemanticsNode) }.firstOrNull {
        it.config.getOrNull(SemanticsProperties.VerticalScrollAxisRange) != null && it.config.getOrNull(SemanticsActions.ScrollBy) != null
    }
    check(node?.config?.getOrNull(SemanticsActions.ScrollBy)?.action?.invoke(0f, delta) == true) { "No scrollable work page" }
}
