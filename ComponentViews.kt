package uk.co.aegismedicalsolutions.eresus.ui.components

import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import uk.co.aegismedicalsolutions.eresus.models.AppSettings
import uk.co.aegismedicalsolutions.eresus.models.ChecklistItem
import uk.co.aegismedicalsolutions.eresus.models.Event
import uk.co.aegismedicalsolutions.eresus.services.Metronome
import uk.co.aegismedicalsolutions.eresus.services.TimeFormatter
import uk.co.aegismedicalsolutions.eresus.viewmodels.ArrestViewModel

// MARK: - Buttons and Headers

@Composable
fun ActionButton(
    title: String,
    icon: @Composable (() -> Unit)? = null,
    backgroundColor: Color,
    foregroundColor: Color,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    action: () -> Unit,
) {
    Button(
        onClick = action,
        modifier = modifier.fillMaxWidth().height(60.dp),
        enabled = enabled,
        colors = ButtonDefaults.buttonColors(
            containerColor = backgroundColor,
            contentColor = foregroundColor,
            disabledContainerColor = backgroundColor.copy(alpha = 0.4f)
        ),
        shape = MaterialTheme.shapes.large
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center
        ) {
            if (icon != null) {
                icon()
                Spacer(Modifier.width(8.dp))
            }
            Text(title, fontWeight = FontWeight.SemiBold, fontSize = 18.sp)
        }
    }
}

@Composable
fun HeaderView(viewModel: ArrestViewModel) {
    val masterTime by viewModel.masterTime.collectAsState()
    val arrestState by viewModel.arrestState.collectAsState()
    val timeOffset by viewModel.timeOffset.collectAsState()

    Surface(shadowElevation = 4.dp) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column {
                    Text("eResus", style = MaterialTheme.typography.headlineLarge)
                    Text(
                        arrestState.name,
                        color = Color.White,
                        modifier = Modifier.padding(vertical = 4.dp),
                        style = MaterialTheme.typography.labelSmall
                    )
                }
                Column(horizontalAlignment = Alignment.End) {
                    Text(
                        TimeFormatter.format(masterTime),
                        fontSize = 50.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.primary
                    )
                    if (arrestState == uk.co.aegismedicalsolutions.eresus.models.ArrestState.ACTIVE || arrestState == uk.co.aegismedicalsolutions.eresus.models.ArrestState.PENDING) {
                        // TimeOffsetButtons(onOffset = { viewModel.addTimeOffset(it) })
                    }
                }
            }
            if (arrestState != uk.co.aegismedicalsolutions.eresus.models.ArrestState.PENDING) {
                CountersView(viewModel)
            }
        }
    }
}

@Composable
fun CountersView(viewModel: ArrestViewModel) {
    val shockCount by viewModel.shockCount.collectAsState()
    //... other counters
    Row(
        modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
        horizontalArrangement = Arrangement.SpaceAround
    ) {
        CounterItem(label = "Shocks", value = shockCount)
        // ... other counter items
    }
}

@Composable
fun CounterItem(label: String, value: Int) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(value.toString(), style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        Text(label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}


// MARK: - Screen State Views

@Composable
fun PendingView(onStartArrest: () -> Unit) {
    Column(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(30.dp)
    ) {
        ActionButton(
            title = "Start Arrest",
            backgroundColor = Color.Red,
            foregroundColor = Color.White,
            action = onStartArrest,
            modifier = Modifier.height(65.dp)
        )
        AlgorithmGridView(onPdfSelected = {})
    }
}

@Composable
fun ActiveArrestContentView(
    viewModel: ArrestViewModel,
    metronome: Metronome,
    onShowOtherDrugs: () -> Unit,
    onShowEtco2: () -> Unit
) {
    val cprTime by viewModel.cprTime.collectAsState()
    
    Column(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(24.dp)
    ) {
        Box {
            CPRTimerView(cprTime = cprTime)
            MetronomeButton(
                metronome = metronome,
                modifier = Modifier.align(Alignment.BottomEnd).offset(x = 10.dp, y = 10.dp)
            )
        }
        ActionGridView(
            viewModel = viewModel,
            onShowOtherDrugsModal = onShowOtherDrugs,
            onShowEtco2Modal = onShowEtco2
        )
    }
}

@Composable
fun RoscView(viewModel: ArrestViewModel, onShowOtherDrugs: () -> Unit) {
    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(24.dp)) {
         ActionButton(title = "Patient Re-Arrested", icon = { Icon(Icons.Default.SyncProblem, null) }, backgroundColor = Color.Yellow, foregroundColor = Color.Black, action = { viewModel.reArrest() })
    }
}

@Composable
fun EndedView(viewModel: ArrestViewModel) {
    // Implement EndedView content
}


// MARK: - Reusable Components

@Composable
fun CPRTimerView(cprTime: Double) {
    val progress = (cprTime / AppSettings.cprCycleDuration).toFloat()
    val color = if (cprTime <= 10) Color.Red else MaterialTheme.colorScheme.primary

    Box(contentAlignment = Alignment.Center, modifier = Modifier.size(250.dp)) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            drawArc(
                color = Color.LightGray,
                startAngle = 0f,
                sweepAngle = 360f,
                useCenter = false,
                style = Stroke(width = 20.dp.toPx())
            )
            drawArc(
                color = color,
                startAngle = -90f,
                sweepAngle = 360 * progress,
                useCenter = false,
                style = Stroke(width = 20.dp.toPx(), cap = StrokeCap.Round)
            )
        }
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                TimeFormatter.format(cprTime),
                fontSize = 60.sp,
                fontWeight = FontWeight.Bold,
                color = color
            )
            Text("CPR CYCLE", style = MaterialTheme.typography.headlineSmall)
        }
    }
}

@Composable
fun MetronomeButton(metronome: Metronome, modifier: Modifier = Modifier) {
    val isMetronomeOn by metronome.isMetronomeOn.collectAsState()
    IconButton(
        onClick = { metronome.toggle() },
        modifier = modifier.size(44.dp),
        colors = IconButtonDefaults.iconButtonColors(
            containerColor = if (isMetronomeOn) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant,
            contentColor = if (isMetronomeOn) Color.White else MaterialTheme.colorScheme.primary
        )
    ) {
        Icon(Icons.Default.Metronome, contentDescription = "Toggle Metronome")
    }
}


@Composable
fun ActionGridView(
    viewModel: ArrestViewModel,
    onShowOtherDrugsModal: () -> Unit,
    onShowEtco2Modal: () -> Unit
) {
    // This would contain the full grid of buttons for analyse, shock, meds, etc.
    // For brevity, a simplified version is shown.
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
         ActionButton(title = "Analyse Rhythm", icon = { Icon(Icons.Default.Waveform, null) }, backgroundColor = MaterialTheme.colorScheme.primary, foregroundColor = Color.White, action = { viewModel.analyseRhythm() })
         ActionButton(title = "Adrenaline", icon = { Icon(Icons.Default.Vaccines, null) }, backgroundColor = Color.Magenta, foregroundColor = Color.White, action = { viewModel.logAdrenaline() })
    }
}

@Composable
fun AlgorithmGridView(onPdfSelected: (String) -> Unit) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("Resuscitation Council UK", style = MaterialTheme.typography.headlineSmall)
        LazyVerticalGrid(
            columns = GridCells.Fixed(2),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            item { AlgorithmCard(title = "Adult ALS", onClick = { onPdfSelected("adult_als") }) }
            item { AlgorithmCard(title = "Paediatric ALS", onClick = { onPdfSelected("paediatric_als") }) }
            item { AlgorithmCard(title = "Newborn LS", onClick = { onPdfSelected("newborn_ls") }) }
            item { AlgorithmCard(title = "Post Arrest Care", onClick = { onPdfSelected("post_arrest") }) }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AlgorithmCard(title: String, onClick: () -> Unit) {
    Card(onClick = onClick, modifier = Modifier.height(80.dp).fillMaxWidth()) {
        Box(contentAlignment = Alignment.Center, modifier = Modifier.fillMaxSize()) {
            Text(title, fontWeight = FontWeight.SemiBold, textAlign = TextAlign.Center)
        }
    }
}

@Composable
fun BottomControlsView(
    modifier: Modifier = Modifier,
    canUndo: Boolean,
    onUndo: () -> Unit,
    onSummary: () -> Unit,
    onReset: () -> Unit
) {
    Surface(modifier = modifier, shadowElevation = 8.dp) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.SpaceEvenly,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Button(onClick = onUndo, enabled = canUndo) { Text("Undo") }
            Button(onClick = onSummary) { Text("Summary") }
            Button(
                onClick = onReset,
                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
            ) { Text("Reset") }
        }
    }
}
