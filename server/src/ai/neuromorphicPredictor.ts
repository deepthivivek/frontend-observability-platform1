/**
 * Neuromorphic Spiking Neural Network (SNN) Predictor
 * Processes raw event streams and eBPF packet vectors as asynchronous event spikes using leaky integrate-and-fire models.
 */

export interface SpikeEvent {
  id: string;
  timestamp: number;
  neuronId: string;
  membranePotential: number; // mV (-70 to +40)
  threshold: number; // default -50mV
  fired: boolean;
  spikeFrequencyHz: number;
  layer: 'input' | 'hidden' | 'predictive_output';
}

export interface MembraneState {
  globalVoltage: number;
  averageFiringRateHz: number;
  cascadingFailureProbability: number;
  activeSpikeTrains: number;
  status: 'STABLE' | 'ELEVATED_ACTIVITY' | 'CRITICAL_CASCADE_IMMINENT';
}

class NeuromorphicPredictorEngine {
  private spikeHistory: SpikeEvent[] = [];
  private neurons: Map<string, { voltage: number; threshold: number; leak: number }> = new Map();

  constructor() {
    // Initialize default neurons
    for (let i = 1; i <= 32; i++) {
      this.neurons.set(`neuron-ebpf-${i}`, {
        voltage: -68.5 + Math.random() * 3,
        threshold: -50.0,
        leak: 0.15,
      });
    }
  }

  public getSpikes(limit = 50): SpikeEvent[] {
    if (this.spikeHistory.length === 0) {
      this.generateBurst(15);
    }
    return this.spikeHistory.slice(-limit);
  }

  public simulateBurst(intensity = 1.0): { simulatedSpikes: number; riskDelta: number; membraneState: MembraneState } {
    const newSpikes: SpikeEvent[] = [];
    let firingCount = 0;
    const now = Date.now();

    this.neurons.forEach((neuron, id) => {
      // Add current injection from eBPF vector burst
      const currentInjection = (Math.random() * 18 + 5) * intensity;
      neuron.voltage += currentInjection - neuron.leak * 5;

      let fired = false;
      if (neuron.voltage >= neuron.threshold) {
        fired = true;
        firingCount++;
        neuron.voltage = -70.0; // Reset after spike
      }

      const spike: SpikeEvent = {
        id: `spike-${now}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: now + Math.floor(Math.random() * 50),
        neuronId: id,
        membranePotential: Number(neuron.voltage.toFixed(2)),
        threshold: neuron.threshold,
        fired,
        spikeFrequencyHz: Number((fired ? 120 + Math.random() * 80 : 15 + Math.random() * 25).toFixed(1)),
        layer: id.includes('1') || id.includes('2') ? 'input' : id.includes('3') ? 'hidden' : 'predictive_output',
      };

      this.spikeHistory.push(spike);
      newSpikes.push(spike);
    });

    if (this.spikeHistory.length > 200) {
      this.spikeHistory = this.spikeHistory.slice(-200);
    }

    const membraneState = this.getMembraneState();
    return {
      simulatedSpikes: newSpikes.length,
      riskDelta: Number((firingCount / 32 * intensity).toFixed(3)),
      membraneState,
    };
  }

  public getMembraneState(): MembraneState {
    let totalVoltage = 0;
    let totalFreq = 0;
    let firingCount = 0;

    this.neurons.forEach((n) => {
      totalVoltage += n.voltage;
      if (n.voltage > -55) firingCount++;
    });

    const avgVoltage = totalVoltage / this.neurons.size;
    const cascadeProb = Math.min(0.99, Math.max(0.02, (avgVoltage + 70) / 30 * (firingCount / 10)));
    const avgFreq = 45 + cascadeProb * 180;

    let status: MembraneState['status'] = 'STABLE';
    if (cascadeProb > 0.75) {
      status = 'CRITICAL_CASCADE_IMMINENT';
    } else if (cascadeProb > 0.4) {
      status = 'ELEVATED_ACTIVITY';
    }

    return {
      globalVoltage: Number(avgVoltage.toFixed(2)),
      averageFiringRateHz: Number(avgFreq.toFixed(1)),
      cascadingFailureProbability: Number(cascadeProb.toFixed(3)),
      activeSpikeTrains: firingCount,
      status,
    };
  }

  private generateBurst(count: number) {
    for (let i = 0; i < count; i++) {
      this.simulateBurst(0.8);
    }
  }
}

export const neuromorphicEngine = new NeuromorphicPredictorEngine();
