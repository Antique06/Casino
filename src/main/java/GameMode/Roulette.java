package main.java.GameMode;

import java.util.Random;

public class Roulette {
    private final Number[] numbers = Number.values();

    public Roulette() {}

    public boolean game(Number n) {
        return n.equals(generateRouletteNumber());
    }

    private Number generateRouletteNumber() {
        Random random = new Random();
        return numbers[random.nextInt(38)];
    }

    public Number[] getNumbers() {
        return numbers;
    }
}
