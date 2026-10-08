package io.nahhasio.client.library

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.ui.input.key.*
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import io.nahhasio.client.generated.WorkDetail
import io.nahhasio.client.api.NahhasioApi
import io.nahhasio.client.ui.*

val workTabs = listOf("نظرة عامة", "الأجزاء والحلقات", "المحتوى والتقييم", "الأشخاص", "البيانات والعلاقات", "الصور")

@Composable
fun WorkScreen(api: NahhasioApi, work: WorkDetail, initialTab: Int = 0, onBack: () -> Unit = {}, onTabSelected: (Int) -> Unit = {}, onEpisodeSelected: (String) -> Unit = {}, onOpenWork: (String) -> Unit = {}) {
    var selectedTab by remember(work.id) { mutableStateOf(initialTab.coerceIn(workTabs.indices)) }
    val tabFocus = remember { List(workTabs.size) { FocusRequester() } }
    fun selectTab(index: Int) { selectedTab = index; tabFocus[index].requestFocus() }
    LaunchedEffect(selectedTab) { onTabSelected(selectedTab) }
    LazyColumn(Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(20.dp), contentPadding = PaddingValues(bottom = 32.dp)) {
        item {
            Column {
                TextButton(onClick = onBack, modifier = Modifier.padding(horizontal = 14.dp)) { Text("العودة إلى المكتبة") }
                WorkHero(api, work)
            }
        }
        item {
            Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).selectableGroup().onKeyEvent { event ->
                if (event.type != KeyEventType.KeyDown) false else when (event.key) {
                    Key.DirectionLeft -> { selectTab((selectedTab + 1).coerceAtMost(workTabs.lastIndex)); true }
                    Key.DirectionRight -> { selectTab((selectedTab - 1).coerceAtLeast(0)); true }
                    Key.MoveHome -> { selectTab(0); true }
                    Key.MoveEnd -> { selectTab(workTabs.lastIndex); true }
                    else -> false
                }
            }.padding(horizontal = 20.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                workTabs.forEachIndexed { index, label ->
                    Column(Modifier.focusRequester(tabFocus[index]).selectable(selectedTab == index, role = Role.Tab, onClick = { selectTab(index) }).padding(horizontal = 12.dp, vertical = 10.dp)) {
                        Text(label, style = MaterialTheme.typography.labelLarge, color = if (selectedTab == index) DesktopPalette.text else DesktopPalette.muted)
                        Spacer(Modifier.height(8.dp))
                        HorizontalDivider(Modifier.width(if (index == selectedTab) 40.dp else 0.dp), color = DesktopPalette.text, thickness = 2.dp)
                    }
                }
            }
        }
        item {
            Column(Modifier.fillMaxWidth().padding(horizontal = 24.dp), verticalArrangement = Arrangement.spacedBy(18.dp)) {
                when (selectedTab) {
                    0 -> WorkOverview(work)
                    1 -> WorkEpisodes(api, work, onEpisodeSelected)
                    2 -> WorkEditorial(work)
                    3 -> WorkPeople(api, work)
                    4 -> WorkMetadata(work, onOpenWork)
                    5 -> WorkArtwork(api, work)
                }
            }
        }
    }
}
