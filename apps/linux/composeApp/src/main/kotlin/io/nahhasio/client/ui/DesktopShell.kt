package io.nahhasio.client.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun DesktopShell(name: String, server: String, onLogout: () -> Unit, immersive: Boolean = false, content: @Composable () -> Unit) {
    BoxWithConstraints(Modifier.fillMaxSize().background(DesktopPalette.canvas)) {
        val narrow = maxWidth < 640.dp
        if (maxWidth >= 1100.dp && !immersive) Row(Modifier.fillMaxSize()) {
            DesktopSidebar(name, server, onLogout)
            Box(Modifier.weight(1f).fillMaxHeight().padding(horizontal = 30.dp, vertical = 24.dp)) { content() }
        } else Column(Modifier.fillMaxSize()) {
            Row(Modifier.fillMaxWidth().background(DesktopPalette.sidebar).padding(horizontal = 18.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("نحاسيو", style = MaterialTheme.typography.titleLarge)
                Text("المكتبة", Modifier.weight(1f), color = DesktopPalette.muted, style = MaterialTheme.typography.bodySmall)
                TextButton(onClick = onLogout) { Text("خروج") }
            }
            Box(Modifier.weight(1f).fillMaxWidth().padding(horizontal = if (immersive) 0.dp else if (narrow) 14.dp else 24.dp, vertical = if (immersive) 0.dp else 16.dp)) { content() }
        }
    }
}

@Composable
private fun DesktopSidebar(name: String, server: String, onLogout: () -> Unit) {
    Column(Modifier.width(208.dp).fillMaxHeight().background(DesktopPalette.sidebar).padding(18.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("نحاسيو", style = MaterialTheme.typography.headlineMedium, modifier = Modifier.padding(top = 10.dp, bottom = 30.dp))
        Text("مكتبتك", color = DesktopPalette.muted, style = MaterialTheme.typography.labelSmall, modifier = Modifier.padding(bottom = 8.dp))
        Surface(color = DesktopPalette.elevated, shape = RoundedCornerShape(8.dp), modifier = Modifier.fillMaxWidth()) {
            Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                DesktopIcon(DesktopSymbol.Library); Text("جميع الأعمال", style = MaterialTheme.typography.labelLarge)
            }
        }
        SidePending(DesktopSymbol.Saved, "المحفوظات")
        SidePending(DesktopSymbol.Download, "التنزيلات")
        Spacer(Modifier.weight(1f))
        HorizontalDivider(color = DesktopPalette.border)
        Column(Modifier.padding(top = 12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(name, style = MaterialTheme.typography.titleMedium)
            Text("متصل بالخادم", style = MaterialTheme.typography.bodySmall, color = DesktopPalette.muted)
            Text(server.removePrefix("http://").removePrefix("https://"), style = MaterialTheme.typography.labelSmall, color = DesktopPalette.muted, maxLines = 1)
            TextButton(onClick = onLogout, contentPadding = PaddingValues(0.dp)) { Text("تسجيل الخروج", color = DesktopPalette.muted) }
        }
    }
}

@Composable
private fun SidePending(symbol: DesktopSymbol, label: String) {
    Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        DesktopIcon(symbol)
        Text(label, Modifier.weight(1f), color = DesktopPalette.muted, style = MaterialTheme.typography.bodyMedium)
        Text("قريباً", color = DesktopPalette.muted, style = MaterialTheme.typography.labelSmall)
    }
}
