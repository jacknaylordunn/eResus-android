package uk.co.aegismedicalsolutions.eresus.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import uk.co.aegismedicalsolutions.eresus.models.ArrestState
import uk.co.aegismedicalsolutions.eresus.viewmodels.ArrestViewModel

@Composable
fun ArrestScreen(
    viewModel: ArrestViewModel = viewModel()
) {
    val arrestState by viewModel.arrestState.collectAsState()
    
    Scaffold(
        topBar = { HeaderView(viewModel = viewModel) },
        bottomBar = {
             if (arrestState != ArrestState.PENDING) {
                 BottomControlsView(viewModel = viewModel)
             }
        }
    ) { paddingValues ->
        Box(modifier = Modifier.padding(paddingValues)) {
            when (arrestState) {
                ArrestState.PENDING -> PendingView(viewModel = viewModel)
                ArrestState.ACTIVE -> ActiveArrestContentView(viewModel = viewModel)
                ArrestState.ROSC -> RoscView(viewModel = viewModel)
                ArrestState.ENDED -> EndedView(viewModel = viewModel)
            }
        }
    }
}

@Composable
fun HeaderView(viewModel: ArrestViewModel) {
    val masterTime by viewModel.masterTime.collectAsState()
    val arrestState by viewModel.arrestState.collectAsState()
    
    // Simplified Header View
    Column(modifier = Modifier.padding(16.dp)) {
        Text("eResus", style = MaterialTheme.typography.headlineLarge)
        Text(arrestState.name,
            color = Color.White,
            modifier = Modifier.padding(vertical = 4.dp))
        Text(
            uk.co.aegismedicalsolutions.eresus.services.TimeFormatter.format(masterTime),
            fontSize = 50.sp,
            fontWeight = FontWeight.Bold
        )
    }
}

// You would continue to create composables for each view:
// PendingView, ActiveArrestContentView, RoscView, EndedView, BottomControlsView etc.

@Composable
fun ActionButton(
    title: String,
    backgroundColor: Color,
    foregroundColor: Color,
    onClick: () -> Unit
) {
    Button(
        onClick = onClick,
        colors = ButtonDefaults.buttonColors(containerColor = backgroundColor, contentColor = foregroundColor),
        modifier = Modifier.fillMaxWidth().height(50.dp)
    ) {
        Text(title, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
fun PendingView(viewModel: ArrestViewModel) {
    Box(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        ActionButton(
            title = "Start Arrest",
            backgroundColor = Color.Red,
            foregroundColor = Color.White,
            onClick = { viewModel.startArrest() }
        )
    }
}

// Define other content views (ActiveArrestContentView, RoscView, etc.) similarly
@Composable
fun ActiveArrestContentView(viewModel: ArrestViewModel) {
    // This would contain the CPR timer, action grids, checklists etc.
    Text("Active Arrest Content...")
}

@Composable
fun RoscView(viewModel: ArrestViewModel) {
    Text("ROSC Content...")
}

@Composable
fun EndedView(viewModel: ArrestViewModel) {
    Text("Ended Content...")
}

@Composable
fun BottomControlsView(viewModel: ArrestViewModel) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(16.dp),
        horizontalArrangement = Arrangement.SpaceAround
    ) {
        Button(onClick = { /* Undo */ }) { Text("Undo") }
        Button(onClick = { /* Summary */ }) { Text("Summary") }
        Button(
            onClick = { viewModel.performReset(true, true) },
            colors = ButtonDefaults.buttonColors(containerColor = Color.Red)
        ) { Text("Reset") }
    }
}
