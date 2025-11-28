package main.java;

public class Player {
    private String name;
    private int money;
    private int maxMoney;

    public Player(String name) {
        this.name = name;
        this.money = 1000;
        this.maxMoney = this.money;
    }

    public int getMaxMoney() {
        return maxMoney;
    }

    public int getMoney() {
        return money;
    }

    public void addMoney(int sum) {
        this.money += sum;
    }

    public void removeMoney(int sum) {
        this.money -= sum;
    }

    public boolean possibleBet(int sum) {
        return sum <= money;
    }

    public boolean bankrupt() {
        return this.money <= 0;
    }
}