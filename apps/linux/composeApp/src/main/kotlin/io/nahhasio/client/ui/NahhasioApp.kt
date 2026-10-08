package io.nahhasio.client.ui

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import io.nahhasio.client.api.*
import io.nahhasio.client.generated.*
import io.nahhasio.client.auth.LoginScreen
import io.nahhasio.client.library.LibraryScreen
import io.nahhasio.client.library.WorkScreen
import kotlinx.coroutines.*

@Composable
fun NahhasioApp() {
    val scope = rememberCoroutineScope()
    var api by remember { mutableStateOf<NahhasioApi?>(null) }
    var name by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var filters by remember { mutableStateOf(LibraryFilters()) }
    var page by remember { mutableStateOf<WorkPage?>(null) }
    var selectedId by remember { mutableStateOf<String?>(null) }
    var work by remember { mutableStateOf<WorkDetail?>(null) }
    LaunchedEffect(api, filters, selectedId) {
        val connection = api ?: return@LaunchedEffect
        busy = true; error = null
        try {
            if (selectedId == null) page = connection.works(filters)
            else { work = null; work = connection.work(selectedId!!) }
        } catch (e: CancellationException) { throw e }
        catch (e: Exception) { error = e.message ?: "تعذر الاتصال"; if (e is ApiException && e.status == 401) api = null }
        finally { busy = false }
    }
    DesktopTheme {
        CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
            Surface(Modifier.fillMaxSize()) {
                if (api == null) Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    LoginScreen(busy, error) { server, email, password -> scope.launch {
                        busy = true; error = null
                        try { val connection = NahhasioApi(server); name = connection.login(email, password); api = connection }
                        catch (e: Exception) { error = e.message ?: "تعذر تسجيل الدخول" }
                        finally { busy = false }
                    } }
                } else DesktopShell(name, api!!.baseUrl, onLogout = { scope.launch {
                    val connection = api; api = null; page = null; work = null; selectedId = null
                    runCatching { connection?.logout() }
                } }, immersive = selectedId != null) {
                    Column(Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        if (busy) LinearProgressIndicator(Modifier.fillMaxWidth(), color = DesktopPalette.muted, trackColor = DesktopPalette.surface)
                        error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                        if (selectedId == null) LibraryScreen(api!!, filters, page, busy, { filters = it }, { selectedId = it })
                        else {
                            work?.let { WorkScreen(api!!, it, onBack = { selectedId = null }, onOpenWork = { id -> selectedId = id }) }
                        }
                    }
                }
            }
        }
    }
}
